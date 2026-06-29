import mqtt, { type MqttClient } from 'mqtt';
import type { Tag } from '@prisma/client';
import type { RuntimeDevice } from '../types.js';

type CachedValue = {
  raw: string;
  value?: number | boolean;
  quality: 'good' | 'bad' | 'uncertain';
  readAt: Date;
};

export type MqttBrokerConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
  timeoutMs: number;
};

function brokerKey(cfg: MqttBrokerConfig): string {
  return `${cfg.host}:${cfg.port}:${cfg.username ?? ''}:${cfg.clientId}`;
}

function resolveBrokerSource(device: RuntimeDevice): RuntimeDevice | null {
  if (device.type === 'converter' && device.protocol === 'mqtt') return device;
  if (device.parent?.protocol === 'mqtt') return device.parent;
  if (device.protocol === 'mqtt') return device;
  return null;
}

export function resolveBrokerConfig(device: RuntimeDevice): { cfg?: MqttBrokerConfig; error?: string } {
  const source = resolveBrokerSource(device);
  if (!source) return { error: 'MQTT broker device is not configured.' };

  const host = source.ipAddress?.trim();
  if (!host) return { error: 'MQTT broker host/IP is required.' };

  const port = Number(source.port ?? 1883);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'MQTT broker port must be between 1 and 65535.' };
  }

  const timeoutMs = Number(source.timeoutMs ?? 5000);
  return {
    cfg: {
      host,
      port,
      username: source.mqttUsername?.trim() || undefined,
      password: source.mqttPassword?.trim() || undefined,
      clientId: source.mqttClientId?.trim() || `energylink_${source.id.slice(-8)}`,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
    },
  };
}

export function resolveMqttTopic(tag: Tag): string {
  const topic = tag.mqttTopic?.trim() || tag.description?.trim() || tag.name.trim();
  return topic;
}

export function parseMqttPayload(
  text: string,
  dataType: string,
): { value?: number | boolean; quality: 'good' | 'bad' | 'uncertain' } {
  if (!text) return { quality: 'bad' };

  const lower = text.trim().toLowerCase();
  if (dataType === 'bool') {
    if (lower === 'true' || lower === '1' || lower === 'on') return { value: true, quality: 'good' };
    if (lower === 'false' || lower === '0' || lower === 'off') return { value: false, quality: 'good' };
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const pick = parsed.value ?? parsed.val ?? parsed.data ?? parsed.payload;
    if (typeof pick === 'boolean') return { value: pick, quality: 'good' };
    if (typeof pick === 'number' && Number.isFinite(pick)) return { value: pick, quality: 'good' };
    if (typeof pick === 'string') {
      const n = Number(pick);
      if (Number.isFinite(n)) return { value: n, quality: 'good' };
    }
  } catch {
    // plain text payload
  }

  const num = Number(text);
  if (Number.isFinite(num)) return { value: num, quality: 'good' };
  return { quality: 'uncertain' };
}

export class MqttBrokerHub {
  private static hubs = new Map<string, MqttBrokerHub>();

  private client: MqttClient | null = null;
  private connecting: Promise<void> | null = null;
  private readonly cache = new Map<string, CachedValue>();
  private readonly subscribed = new Set<string>();
  private readonly cfg: MqttBrokerConfig;

  private constructor(cfg: MqttBrokerConfig) {
    this.cfg = cfg;
  }

  static async get(device: RuntimeDevice): Promise<{ hub?: MqttBrokerHub; error?: string }> {
    const resolved = resolveBrokerConfig(device);
    if (!resolved.cfg) return { error: resolved.error };

    const key = brokerKey(resolved.cfg);
    let hub = MqttBrokerHub.hubs.get(key);
    if (!hub) {
      hub = new MqttBrokerHub(resolved.cfg);
      MqttBrokerHub.hubs.set(key, hub);
    }

    const connectError = await hub.ensureConnected();
    if (connectError) return { error: connectError };
    return { hub };
  }

  private ensureConnected(): Promise<string | undefined> {
    if (this.client?.connected) return Promise.resolve(undefined);
    if (this.connecting) {
      return this.connecting
        .then(() => undefined)
        .catch((error) => (error instanceof Error ? error.message : String(error)));
    }

    this.connecting = new Promise<void>((resolve, reject) => {
      const url = `mqtt://${this.cfg.host}:${this.cfg.port}`;
      const client = mqtt.connect(url, {
        username: this.cfg.username,
        password: this.cfg.password,
        clientId: this.cfg.clientId,
        connectTimeout: this.cfg.timeoutMs,
        reconnectPeriod: 5000,
        keepalive: 30,
      });

      const timer = setTimeout(() => {
        client.end(true);
        reject(new Error('MQTT connection timeout'));
      }, this.cfg.timeoutMs);

      client.once('connect', () => {
        clearTimeout(timer);
        this.client = client;
        client.on('message', (topic, payload) => {
          const text = payload.toString('utf8');
          const parsed = parseMqttPayload(text, 'float32');
          this.cache.set(topic, {
            raw: text,
            value: parsed.value,
            quality: parsed.quality,
            readAt: new Date(),
          });
        });
        resolve();
      });

      client.once('error', (err) => {
        clearTimeout(timer);
        client.end(true);
        reject(err);
      });
    }).finally(() => {
      this.connecting = null;
    });

    return this.connecting
      .then(() => undefined)
      .catch((error) => (error instanceof Error ? error.message : String(error)));
  }

  async subscribeTopic(topic: string): Promise<void> {
    if (this.subscribed.has(topic)) return;
    if (!this.client?.connected) throw new Error('MQTT client is not connected');

    await new Promise<void>((resolve, reject) => {
      this.client!.subscribe(topic, { qos: 0 }, (err) => {
        if (err) reject(err);
        else {
          this.subscribed.add(topic);
          resolve();
        }
      });
    });
  }

  getCached(topic: string): CachedValue | undefined {
    return this.cache.get(topic);
  }

  async publish(topic: string, payload: string): Promise<void> {
    if (!this.client?.connected) throw new Error('MQTT client is not connected');
    await new Promise<void>((resolve, reject) => {
      this.client!.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getEndpoint(): Record<string, unknown> {
    return {
      transport: 'mqtt',
      host: this.cfg.host,
      port: this.cfg.port,
      username: this.cfg.username ?? null,
      clientId: this.cfg.clientId,
    };
  }
}
