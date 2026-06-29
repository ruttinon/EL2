import type { DeviceDriver } from '../types.js';
import { ModbusTcpDriver } from './modbusTcpDriver.js';
import { ModbusRtuDriver } from './modbusRtuDriver.js';
import { CvmC4Driver } from './cvmC4Driver.js';
import { CvmC11Driver } from './cvmC11Driver.js';
import { TcpDriver } from './tcpDriver.js';
import { XgmbMeterDriver } from './xgmbMeterDriver.js';
import { UdpDriver } from './udpDriver.js';
import { MqttDriver } from './mqttDriver.js';

export type DeviceDriverEntry = {
    protocol: string;
    displayName: string;
    createDriver: () => DeviceDriver;
};

export const deviceDrivers: DeviceDriverEntry[] = [
    {
        protocol: 'tcp',
        displayName: 'TCP Converter Driver',
        createDriver: () => new TcpDriver()
    },
    {
        protocol: 'udp',
        displayName: 'UDP Converter Driver',
        createDriver: () => new UdpDriver()
    },
    {
        protocol: 'modbus_tcp',
        displayName: 'Modbus TCP Driver',
        createDriver: () => new ModbusTcpDriver()
    },
    {
        protocol: 'modbus_rtu',
        displayName: 'Modbus RTU Driver',
        createDriver: () => new ModbusRtuDriver()
    },
    {
        protocol: 'cvm_c4',
        displayName: 'CVM-C4 Meter Driver',
        createDriver: () => new CvmC4Driver()
    },
    {
        protocol: 'cvm_c11',
        displayName: 'CVM-C11 Meter Driver',
        createDriver: () => new CvmC11Driver()
    },
    {
        protocol: 'xgmb_meter',
        displayName: 'Imported XGMB Meter Driver',
        createDriver: () => new XgmbMeterDriver()
    },
    {
        protocol: 'mqtt',
        displayName: 'MQTT Broker Driver',
        createDriver: () => new MqttDriver()
    }
];

export function getDriverFromRegistry(protocol: string): DeviceDriver | undefined {
    const entry = deviceDrivers.find((driver) => driver.protocol === protocol);
    return entry?.createDriver();
}
