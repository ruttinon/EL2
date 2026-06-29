declare module 'modbus-serial' {
  class ModbusRTU {
    setTimeout(ms: number): void;
    connectTCP(ip: string, options: { port: number }): Promise<void>;
    connectRTUBuffered(path: string, options: { baudRate: number; dataBits: number; stopBits: number; parity: 'none' | 'even' | 'odd' }): Promise<void>;
    setID(id: number): void;
    close(callback?: () => void): void;
    readCoils(address: number, length: number): Promise<{ data: boolean[] }>;
    readDiscreteInputs(address: number, length: number): Promise<{ data: boolean[] }>;
    readInputRegisters(address: number, length: number): Promise<{ data: number[]; buffer: Buffer }>;
    readHoldingRegisters(address: number, length: number): Promise<{ data: number[]; buffer: Buffer }>;
  }
  export default ModbusRTU;
}
