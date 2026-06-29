export type ModbusClient = {
  setTimeout(ms: number): void;
  connectTCP(ip: string, options: { port: number }): Promise<void>;
  connectTcpRTUBuffered(ip: string, options: { port: number }): Promise<void>;
  connectUDP(ip: string, options: { port: number }): Promise<void>;
  connectRTUBuffered(path: string, options: { baudRate: number; dataBits: number; stopBits: number; parity: 'none' | 'even' | 'odd' }): Promise<void>;
  setID(id: number): void;
  close(callback?: () => void): void;
  readCoils(address: number, length: number): Promise<{ data: boolean[] }>;
  readDiscreteInputs(address: number, length: number): Promise<{ data: boolean[] }>;
  readInputRegisters(address: number, length: number): Promise<{ data: number[]; buffer: Buffer }>;
  readHoldingRegisters(address: number, length: number): Promise<{ data: number[]; buffer: Buffer }>;
  writeCoil(address: number, value: boolean): Promise<void>;
  writeRegister(address: number, value: number): Promise<void>;
  writeRegisters(address: number, values: number[]): Promise<void>;
};

export type ModbusConstructor = new () => ModbusClient;

export async function createClient(): Promise<ModbusClient> {
  const mod = await import('modbus-serial');
  const Constructor = (mod.default ?? mod) as unknown as ModbusConstructor;
  return new Constructor();
}

export function closeClient(client: ModbusClient) {
  try {
    client.close(() => undefined);
  } catch {
    // Close errors are non-authoritative; the connection/read result is returned separately.
  }
}
