import type { Tag } from '@prisma/client';
import type { DeviceConnectionResult, DeviceDriver, ReadTagOnceResult, RuntimeDevice, WriteTagResult } from '../types.js';
import { finishConnectionResult } from '../types.js';

export class UnsupportedDriver implements DeviceDriver {
    constructor(public readonly protocol: string, private readonly reason: string) { }

    async testConnection(device: RuntimeDevice): Promise<DeviceConnectionResult> {
        const startedAt = new Date();
        return finishConnectionResult(device, startedAt, false, 'unsupported', this.reason);
    }

    async readTagOnce(device: RuntimeDevice, tag: Tag): Promise<ReadTagOnceResult> {
        const startedAt = new Date();
        const completedAt = new Date();
        return {
            tagId: tag.id,
            tagName: tag.name,
            deviceId: device.id,
            deviceName: device.name,
            ok: false,
            quality: 'bad',
            readAt: completedAt.toISOString(),
            elapsedMs: completedAt.getTime() - startedAt.getTime(),
            message: this.reason,
            error: this.reason
        };
    }

    async writeTag(device: RuntimeDevice, tag: Tag, value: number | boolean): Promise<WriteTagResult> {
        const completedAt = new Date();
        return {
            tagId: tag.id,
            tagName: tag.name,
            deviceId: device.id,
            deviceName: device.name,
            ok: false,
            value,
            writtenAt: completedAt.toISOString(),
            elapsedMs: 0,
            message: this.reason,
            error: this.reason
        };
    }
}
