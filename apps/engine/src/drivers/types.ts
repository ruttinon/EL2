import type { Device, Tag } from '@prisma/client';

export type RuntimeDevice = Device & { parent?: Device | null };

export type DeviceConnectionResult = {
  deviceId: string;
  deviceName: string;
  protocol: string;
  ok: boolean;
  status: 'online' | 'offline' | 'unsupported' | 'invalid_configuration';
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  message: string;
  error?: string;
  endpoint?: Record<string, unknown>;
};

export type ReadTagOnceResult = {
  tagId: string;
  tagName: string;
  deviceId: string;
  deviceName: string;
  ok: boolean;
  value?: number | boolean;
  rawValue?: unknown;
  quality: 'good' | 'bad' | 'uncertain';
  unit?: string | null;
  readAt: string;
  elapsedMs: number;
  message: string;
  error?: string;
  endpoint?: Record<string, unknown>;
};

export type WriteTagResult = {
  tagId: string;
  tagName: string;
  deviceId: string;
  deviceName: string;
  ok: boolean;
  value: number | boolean;
  writtenAt: string;
  elapsedMs: number;
  message: string;
  error?: string;
  endpoint?: Record<string, unknown>;
};

export interface DeviceDriver {
  readonly protocol: string;
  testConnection(device: RuntimeDevice): Promise<DeviceConnectionResult>;
  readTagOnce(device: RuntimeDevice, tag: Tag): Promise<ReadTagOnceResult>;
  readTags?(device: RuntimeDevice, tags: Tag[]): Promise<ReadTagOnceResult[]>;
  writeTag(device: RuntimeDevice, tag: Tag, value: number | boolean): Promise<WriteTagResult>;
}

export function finishConnectionResult(
  device: RuntimeDevice,
  startedAt: Date,
  ok: boolean,
  status: DeviceConnectionResult['status'],
  message: string,
  error?: string,
  endpoint?: Record<string, unknown>
): DeviceConnectionResult {
  const completedAt = new Date();
  return {
    deviceId: device.id,
    deviceName: device.name,
    protocol: device.protocol,
    ok,
    status,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    elapsedMs: completedAt.getTime() - startedAt.getTime(),
    message,
    error,
    endpoint
  };
}
