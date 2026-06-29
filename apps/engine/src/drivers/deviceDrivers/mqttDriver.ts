import type { Tag } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
import type { DeviceConnectionResult, DeviceDriver, ReadTagOnceResult, RuntimeDevice, WriteTagResult } from '../types.js';
import { finishConnectionResult } from '../types.js';
import { MqttBrokerHub, parseMqttPayload, resolveMqttTopic } from '../mqtt/mqttBrokerHub.js';

function scaleTagValue(tag: Tag, value: number): number {
  return value * Number(tag.scale ?? 1) + Number(tag.offset ?? 0);
}

export class MqttDriver implements DeviceDriver {
  readonly protocol = 'mqtt';

  async testConnection(device: RuntimeDevice): Promise<DeviceConnectionResult> {
    const startedAt = new Date();
    try {
      const { hub, error } = await MqttBrokerHub.get(device);
      if (!hub) {
        return finishConnectionResult(
          device,
          startedAt,
          false,
          'invalid_configuration',
          error ?? 'MQTT broker connection failed.',
          error,
        );
      }
      return finishConnectionResult(
        device,
        startedAt,
        true,
        'online',
        'MQTT broker connected successfully.',
        undefined,
        hub.getEndpoint(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return finishConnectionResult(device, startedAt, false, 'offline', 'MQTT broker connection failed.', message);
    }
  }

  async readTagOnce(device: RuntimeDevice, tag: Tag): Promise<ReadTagOnceResult> {
    const startedAt = new Date();
    const topic = resolveMqttTopic(tag);
    const endpointBase = { topic };

    try {
      const { hub, error } = await MqttBrokerHub.get(device);
      if (!hub) {
        return {
          tagId: tag.id,
          tagName: tag.name,
          deviceId: device.id,
          deviceName: device.name,
          ok: false,
          quality: 'bad',
          readAt: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt.getTime(),
          message: error ?? 'MQTT broker unavailable.',
          error,
          endpoint: endpointBase,
        };
      }

      await hub.subscribeTopic(topic);
      let cached = hub.getCached(topic);
      if (!cached) {
        await delay(Math.min(500, Number(device.timeoutMs ?? 500)));
        cached = hub.getCached(topic);
      }

      if (!cached) {
        return {
          tagId: tag.id,
          tagName: tag.name,
          deviceId: device.id,
          deviceName: device.name,
          ok: false,
          quality: 'uncertain',
          readAt: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt.getTime(),
          message: `No MQTT payload received yet for topic "${topic}".`,
          endpoint: { ...hub.getEndpoint(), ...endpointBase },
        };
      }

      const parsed = parseMqttPayload(cached.raw, tag.dataType);
      if (parsed.value === undefined) {
        return {
          tagId: tag.id,
          tagName: tag.name,
          deviceId: device.id,
          deviceName: device.name,
          ok: false,
          rawValue: cached.raw,
          quality: parsed.quality,
          readAt: cached.readAt.toISOString(),
          elapsedMs: Date.now() - startedAt.getTime(),
          message: `Could not parse MQTT payload for topic "${topic}".`,
          endpoint: { ...hub.getEndpoint(), ...endpointBase },
        };
      }

      const scaled = typeof parsed.value === 'number' ? scaleTagValue(tag, parsed.value) : parsed.value;
      return {
        tagId: tag.id,
        tagName: tag.name,
        deviceId: device.id,
        deviceName: device.name,
        ok: true,
        value: scaled,
        rawValue: cached.raw,
        quality: 'good',
        unit: tag.unit,
        readAt: cached.readAt.toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        message: 'MQTT tag value read from cache.',
        endpoint: { ...hub.getEndpoint(), ...endpointBase },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        tagId: tag.id,
        tagName: tag.name,
        deviceId: device.id,
        deviceName: device.name,
        ok: false,
        quality: 'bad',
        readAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        message: 'MQTT tag read failed.',
        error: message,
        endpoint: endpointBase,
      };
    }
  }

  async readTags(device: RuntimeDevice, tags: Tag[]): Promise<ReadTagOnceResult[]> {
    const { hub, error } = await MqttBrokerHub.get(device);
    if (!hub) {
      return tags.map((tag) => ({
        tagId: tag.id,
        tagName: tag.name,
        deviceId: device.id,
        deviceName: device.name,
        ok: false,
        quality: 'bad' as const,
        readAt: new Date().toISOString(),
        elapsedMs: 0,
        message: error ?? 'MQTT broker unavailable.',
        error,
      }));
    }

    await Promise.all(tags.map(async (tag) => {
      try {
        await hub.subscribeTopic(resolveMqttTopic(tag));
      } catch {
        // individual subscribe errors handled in readTagOnce
      }
    }));

    await delay(Math.min(300, Number(device.timeoutMs ?? 300)));
    return Promise.all(tags.map((tag) => this.readTagOnce(device, tag)));
  }

  async writeTag(device: RuntimeDevice, tag: Tag, value: number | boolean): Promise<WriteTagResult> {
    const startedAt = new Date();
    const topic = resolveMqttTopic(tag);
    const payload = tag.dataType === 'bool' ? (value ? '1' : '0') : String(value);

    try {
      const { hub, error } = await MqttBrokerHub.get(device);
      if (!hub) {
        return {
          tagId: tag.id,
          tagName: tag.name,
          deviceId: device.id,
          deviceName: device.name,
          ok: false,
          value,
          writtenAt: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt.getTime(),
          message: error ?? 'MQTT broker unavailable.',
          error,
        };
      }

      await hub.publish(topic, payload);
      return {
        tagId: tag.id,
        tagName: tag.name,
        deviceId: device.id,
        deviceName: device.name,
        ok: true,
        value,
        writtenAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        message: `Published MQTT payload to "${topic}".`,
        endpoint: { ...hub.getEndpoint(), topic, payload },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        tagId: tag.id,
        tagName: tag.name,
        deviceId: device.id,
        deviceName: device.name,
        ok: false,
        value,
        writtenAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt.getTime(),
        message: 'MQTT publish failed.',
        error: message,
      };
    }
  }
}
