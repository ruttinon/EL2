import * as net from 'node:net';
import * as dgram from 'node:dgram';
import type { ModbusClient } from './clientTypes.js';

function crc16Modbus(payload: Buffer) {
  let crc = 0xffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      if ((crc & 1) !== 0) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc & 0xffff;
}

function appendCrc(payload: Buffer) {
  const crc = crc16Modbus(payload);
  return Buffer.concat([payload, Buffer.from([crc & 0xff, (crc >> 8) & 0xff])]);
}

function verifyCrc(frame: Buffer) {
  if (frame.length < 4) return false;
  const body = frame.subarray(0, frame.length - 2);
  const expected = crc16Modbus(body);
  const actual = frame[frame.length - 2] | (frame[frame.length - 1] << 8);
  return expected === actual;
}

function functionName(functionCode: number) {
  switch (functionCode) {
    case 1: return 'Read Coils';
    case 2: return 'Read Discrete Inputs';
    case 3: return 'Read Holding Registers';
    case 4: return 'Read Input Registers';
    case 5: return 'Write Single Coil';
    case 6: return 'Write Single Register';
    case 16: return 'Write Multiple Registers';
    default: return `Function ${functionCode}`;
  }
}

function exceptionName(code: number) {
  switch (code) {
    case 1: return 'Illegal function';
    case 2: return 'Illegal data address';
    case 3: return 'Illegal data value';
    case 4: return 'Slave device failure';
    case 5: return 'Acknowledge';
    case 6: return 'Slave device busy';
    case 8: return 'Memory parity error';
    case 10: return 'Gateway path unavailable';
    case 11: return 'Gateway target failed to respond';
    default: return `Modbus exception ${code}`;
  }
}

function makeRequest(slaveId: number, functionCode: number, address: number, quantityOrValue: number, values?: number[]) {
  let body: Buffer;
  if (functionCode === 16 && values) {
    const registers = Buffer.alloc(values.length * 2);
    values.forEach((value, index) => registers.writeUInt16BE(value & 0xffff, index * 2));
    body = Buffer.alloc(7);
    body[0] = slaveId;
    body[1] = functionCode;
    body.writeUInt16BE(address, 2);
    body.writeUInt16BE(values.length, 4);
    body[6] = registers.length;
    return appendCrc(Buffer.concat([body, registers]));
  }

  body = Buffer.alloc(6);
  body[0] = slaveId;
  body[1] = functionCode;
  body.writeUInt16BE(address, 2);
  body.writeUInt16BE(quantityOrValue & 0xffff, 4);
  return appendCrc(body);
}

function expectedReadLength(functionCode: number, quantity: number) {
  if (functionCode === 1 || functionCode === 2) return 5 + Math.ceil(quantity / 8);
  if (functionCode === 3 || functionCode === 4) return 5 + quantity * 2;
  return 8;
}

function validateResponse(frame: Buffer, slaveId: number, functionCode: number, endpointLabel: string) {
  if (frame.length < 5) {
    throw new Error(`${endpointLabel}: Incomplete RTU response (${frame.length} bytes).`);
  }
  if (!verifyCrc(frame)) {
    throw new Error(`${endpointLabel}: RTU CRC mismatch. Check baudrate, parity, RS485 wiring, and tunnel mode.`);
  }
  if (frame[0] !== slaveId) {
    throw new Error(`${endpointLabel}: RTU response slave mismatch. Expected ${slaveId}, received ${frame[0]}.`);
  }
  if (frame[1] === (functionCode | 0x80)) {
    const code = frame[2];
    throw new Error(`${endpointLabel}: ${functionName(functionCode)} failed with ${exceptionName(code)} (code ${code}).`);
  }
  if (frame[1] !== functionCode) {
    throw new Error(`${endpointLabel}: RTU function mismatch. Expected ${functionCode}, received ${frame[1]}.`);
  }
}

function bitsFromBytes(buffer: Buffer, count: number) {
  const result: boolean[] = [];
  for (let i = 0; i < count; i += 1) {
    const byte = buffer[Math.floor(i / 8)] ?? 0;
    result.push(((byte >> (i % 8)) & 1) === 1);
  }
  return result;
}

function registersFromBuffer(buffer: Buffer) {
  const data: number[] = [];
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    data.push(buffer.readUInt16BE(i));
  }
  return data;
}

type Transport = 'tcp' | 'udp';

type TunnelOptions = {
  transport: Transport;
  host: string;
  port: number;
  timeoutMs?: number;
};

class RtuTunnelClient implements ModbusClient {
  private timeoutMs: number;
  private slaveId = 1;
  private tcpSocket?: net.Socket;
  private udpSocket?: dgram.Socket;
  private readonly endpointLabel: string;

  constructor(private readonly options: TunnelOptions) {
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.endpointLabel = `RTU over ${options.transport.toUpperCase()} ${options.host}:${options.port}`;
  }

  setTimeout(ms: number): void {
    this.timeoutMs = ms;
    this.tcpSocket?.setTimeout(ms);
  }

  async connectTCP(_ip?: string, _options?: { port: number }): Promise<void> {
    throw new Error('Use createRtuOverTcpClient for TCP tunnel connections.');
  }

  async connectRTUBuffered(_path?: string, _options?: unknown): Promise<void> {
    throw new Error('RTU serial is not handled by the TCP/UDP tunnel client.');
  }

  async connectTcpRTUBuffered(_ip?: string, _options?: { port: number }): Promise<void> {
    await this.open();
  }

  async connectUDP(_ip?: string, _options?: { port: number }): Promise<void> {
    await this.open();
  }

  setID(id: number): void {
    this.slaveId = id;
  }

  close(callback?: () => void): void {
    try {
      this.tcpSocket?.destroy();
      this.udpSocket?.close();
    } finally {
      callback?.();
    }
  }

  private async open() {
    if (this.options.transport === 'tcp') {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host: this.options.host, port: this.options.port });
        const timer = setTimeout(() => {
          socket.destroy();
          reject(new Error(`${this.endpointLabel}: TCP tunnel connection timeout.`));
        }, this.timeoutMs);
        socket.once('connect', () => {
          clearTimeout(timer);
          socket.setNoDelay(true);
          socket.setTimeout(this.timeoutMs);
          this.tcpSocket = socket;
          resolve();
        });
        socket.once('error', (error) => {
          clearTimeout(timer);
          reject(new Error(`${this.endpointLabel}: TCP tunnel connection failed: ${error.message}`));
        });
      });
      return;
    }

    this.udpSocket = dgram.createSocket('udp4');
  }

  private async exchange(request: Buffer, expectedLength: number, functionCode: number) {
    if (this.options.transport === 'tcp') {
      return await this.exchangeTcp(request, expectedLength, functionCode);
    }
    return await this.exchangeUdp(request, expectedLength, functionCode);
  }

  private async exchangeTcp(request: Buffer, expectedLength: number, functionCode: number) {
    if (!this.tcpSocket) await this.open();
    const socket = this.tcpSocket!;
    return await new Promise<Buffer>((resolve, reject) => {
      let data = Buffer.alloc(0);
      const cleanup = () => {
        clearTimeout(timer);
        socket.off('data', onData);
        socket.off('error', onError);
        socket.off('close', onClose);
      };
      const done = (frame: Buffer) => {
        cleanup();
        try {
          validateResponse(frame, this.slaveId, functionCode, this.endpointLabel);
          resolve(frame);
        } catch (error) {
          reject(error);
        }
      };
      const onData = (chunk: Buffer) => {
        data = Buffer.concat([data, chunk]);
        if (data.length >= 5 && data[0] === this.slaveId && data[1] === (functionCode | 0x80) && data.length >= 5) {
          done(data.subarray(0, 5));
          return;
        }
        if (data.length >= expectedLength) {
          done(data.subarray(0, expectedLength));
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new Error(`${this.endpointLabel}: TCP tunnel exchange failed: ${error.message}`));
      };
      const onClose = () => {
        cleanup();
        reject(new Error(`${this.endpointLabel}: TCP tunnel closed before meter response.`));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${this.endpointLabel}: timeout waiting for slave ${this.slaveId} response. Check Slave ID, serial baudrate/parity, RS485 A/B, and TCPRS1+ protocol mode.`));
      }, this.timeoutMs);
      socket.on('data', onData);
      socket.once('error', onError);
      socket.once('close', onClose);
      socket.write(request, (error) => {
        if (error) onError(error);
      });
    });
  }

  private async exchangeUdp(request: Buffer, expectedLength: number, functionCode: number) {
    if (!this.udpSocket) await this.open();
    const socket = this.udpSocket!;
    return await new Promise<Buffer>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        socket.off('message', onMessage);
        socket.off('error', onError);
      };
      const onMessage = (message: Buffer) => {
        cleanup();
        const frame = message.length >= expectedLength ? message.subarray(0, expectedLength) : message;
        try {
          validateResponse(frame, this.slaveId, functionCode, this.endpointLabel);
          resolve(frame);
        } catch (error) {
          reject(error);
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new Error(`${this.endpointLabel}: UDP tunnel exchange failed: ${error.message}`));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${this.endpointLabel}: timeout waiting for slave ${this.slaveId} UDP response. Check Slave ID, serial baudrate/parity, RS485 A/B, and TCPRS1+ UDP mode.`));
      }, this.timeoutMs);
      socket.on('message', onMessage);
      socket.once('error', onError);
      socket.send(request, this.options.port, this.options.host, (error) => {
        if (error) onError(error);
      });
    });
  }

  async readCoils(address: number, length: number): Promise<{ data: boolean[] }> {
    const response = await this.exchange(makeRequest(this.slaveId, 1, address, length), expectedReadLength(1, length), 1);
    return { data: bitsFromBytes(response.subarray(3, 3 + response[2]), length) };
  }

  async readDiscreteInputs(address: number, length: number): Promise<{ data: boolean[] }> {
    const response = await this.exchange(makeRequest(this.slaveId, 2, address, length), expectedReadLength(2, length), 2);
    return { data: bitsFromBytes(response.subarray(3, 3 + response[2]), length) };
  }

  async readInputRegisters(address: number, length: number): Promise<{ data: number[]; buffer: Buffer }> {
    const response = await this.exchange(makeRequest(this.slaveId, 4, address, length), expectedReadLength(4, length), 4);
    const buffer = response.subarray(3, 3 + response[2]);
    return { data: registersFromBuffer(buffer), buffer };
  }

  async readHoldingRegisters(address: number, length: number): Promise<{ data: number[]; buffer: Buffer }> {
    const response = await this.exchange(makeRequest(this.slaveId, 3, address, length), expectedReadLength(3, length), 3);
    const buffer = response.subarray(3, 3 + response[2]);
    return { data: registersFromBuffer(buffer), buffer };
  }

  async writeCoil(address: number, value: boolean): Promise<void> {
    await this.exchange(makeRequest(this.slaveId, 5, address, value ? 0xff00 : 0x0000), 8, 5);
  }

  async writeRegister(address: number, value: number): Promise<void> {
    await this.exchange(makeRequest(this.slaveId, 6, address, value), 8, 6);
  }

  async writeRegisters(address: number, values: number[]): Promise<void> {
    await this.exchange(makeRequest(this.slaveId, 16, address, values.length, values), 8, 16);
  }
}

export async function createRtuOverTcpClient(host: string, port: number, timeoutMs: number): Promise<ModbusClient> {
  const client = new RtuTunnelClient({ transport: 'tcp', host, port, timeoutMs });
  client.setTimeout(timeoutMs);
  await client.connectTcpRTUBuffered(host, { port });
  return client;
}

export async function createRtuOverUdpClient(host: string, port: number, timeoutMs: number): Promise<ModbusClient> {
  const client = new RtuTunnelClient({ transport: 'udp', host, port, timeoutMs });
  client.setTimeout(timeoutMs);
  await client.connectUDP(host, { port });
  return client;
}
