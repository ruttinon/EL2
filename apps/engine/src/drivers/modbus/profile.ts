import type { Device, Tag } from '@prisma/client';

export type RuntimeDevice = Device & { parent?: Device | null };

export type EffectiveModbusTcpProfile = {
  transport: 'tcp';
  ipAddress: string;
  port: number;
  peripheralNumber: number;
  littleEndianData: boolean;
  swapRegisterBytes: boolean;
  maxRegistersPerGroup: number;
  timeoutMs: number;
  sourceDeviceId: string;
  sourceDeviceName: string;
};

export type EffectiveModbusRtuProfile = {
  transport: 'rtu';
  serialPort: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd';
  peripheralNumber: number;
  littleEndianData: boolean;
  swapRegisterBytes: boolean;
  maxRegistersPerGroup: number;
  timeoutMs: number;
  sourceDeviceId: string;
  sourceDeviceName: string;
};

export type EffectiveModbusProfile = EffectiveModbusTcpProfile | EffectiveModbusRtuProfile;

export function integerOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isInteger(Number(value))) return Number(value);
  return undefined;
}

export function resolveTcpProfile(device: RuntimeDevice): { profile?: EffectiveModbusTcpProfile; error?: string } {
  const endpoint = device.ipAddress && device.port ? device : device.parent;
  const peripheralNumber = integerOrUndefined(device.peripheralNumber);
  if (!endpoint?.ipAddress) return { error: 'IP address is required on the device or parent converter.' };
  if (!endpoint.port) return { error: 'TCP port is required on the device or parent converter.' };
  if (peripheralNumber === undefined) return { error: 'Peripheral number is required.' };
  return {
    profile: {
      transport: 'tcp',
      ipAddress: endpoint.ipAddress,
      port: endpoint.port,
      peripheralNumber,
      littleEndianData: device.littleEndianData ?? endpoint.littleEndianData ?? false,
      swapRegisterBytes: device.swapRegisterBytes ?? endpoint.swapRegisterBytes ?? false,
      maxRegistersPerGroup: device.maxRegistersPerGroup ?? endpoint.maxRegistersPerGroup ?? 120,
      timeoutMs: device.timeoutMs ?? endpoint.timeoutMs ?? 2000,
      sourceDeviceId: endpoint.id,
      sourceDeviceName: endpoint.name
    }
  };
}

function normalizeParity(value: unknown): 'none' | 'even' | 'odd' {
  return value === 'even' || value === 'odd' ? value : 'none';
}

export function resolveRtuProfile(device: RuntimeDevice): { profile?: EffectiveModbusRtuProfile; error?: string } {
  const endpoint = device.serialPort ? device : device.parent;
  const peripheralNumber = integerOrUndefined(device.peripheralNumber);
  const baudRate = integerOrUndefined((endpoint as any)?.baudRate) ?? 9600;
  const dataBits = integerOrUndefined((endpoint as any)?.dataBits) ?? 8;
  const stopBits = integerOrUndefined((endpoint as any)?.stopBits) ?? 1;
  const parity = normalizeParity((endpoint as any)?.parity);
  if (!endpoint?.serialPort) return { error: 'Serial port is required on the device or parent converter.' };
  if (peripheralNumber === undefined) return { error: 'Peripheral number is required.' };
  if (![5, 6, 7, 8].includes(dataBits)) return { error: 'Data bits must be 5, 6, 7, or 8.' };
  if (![1, 2].includes(stopBits)) return { error: 'Stop bits must be 1 or 2.' };
  if (baudRate < 300 || baudRate > 921600) return { error: 'Baud rate must be between 300 and 921600.' };
  return {
    profile: {
      transport: 'rtu',
      serialPort: endpoint.serialPort,
      baudRate,
      dataBits,
      stopBits,
      parity,
      peripheralNumber,
      littleEndianData: device.littleEndianData ?? endpoint.littleEndianData ?? false,
      swapRegisterBytes: device.swapRegisterBytes ?? endpoint.swapRegisterBytes ?? false,
      maxRegistersPerGroup: device.maxRegistersPerGroup ?? endpoint.maxRegistersPerGroup ?? 120,
      timeoutMs: device.timeoutMs ?? endpoint.timeoutMs ?? 2000,
      sourceDeviceId: endpoint.id,
      sourceDeviceName: endpoint.name
    }
  };
}

export function validateTagForModbus(tag: Tag): string | undefined {
  if (!Number.isInteger(tag.address) || tag.address < 0) return 'Tag address must be a non-negative integer.';
  if ((tag.registerType === 'coil' || tag.registerType === 'discrete_input') && tag.dataType !== 'bool') {
    return 'Coil and discrete input tags must use bool data type.';
  }
  if ((tag.registerType === 'input_register' || tag.registerType === 'holding_register') && tag.dataType === 'bool') {
    return 'Input register and holding register tags must use a numeric data type.';
  }
  return undefined;
}
