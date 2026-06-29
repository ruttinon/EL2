import type { Device } from '@prisma/client';
import type { DeviceDriver } from './types.js';
import { getDriverFromRegistry } from './deviceDrivers/index.js';
import { UnsupportedDriver } from './deviceDrivers/unsupportedDriver.js';

type DeviceProtocol = Device['protocol'];

export function getDriver(protocol: DeviceProtocol): DeviceDriver {
  const registryDriver = getDriverFromRegistry(protocol);
  if (registryDriver) {
    return registryDriver;
  }

  if (protocol === 'tcp') {
    const tcpDriver = getDriverFromRegistry('tcp');
    if (tcpDriver) return tcpDriver;
  }

  if (protocol === 'udp') {
    const udpDriver = getDriverFromRegistry('udp');
    if (udpDriver) return udpDriver;
  }

  return new UnsupportedDriver(String(protocol), 'Unsupported protocol.');
}
