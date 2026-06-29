import type { Tag } from '@prisma/client';

export function registerLength(dataType: Tag['dataType']) {
  switch (dataType) {
    case 'bool':
    case 'int16':
    case 'uint16':
      return 1;
    case 'int32':
    case 'uint32':
    case 'float32':
      return 2;
    case 'float64':
      return 4;
    default:
      return 1;
  }
}

export function decodeRegisterValue(buffer: Buffer, dataType: Tag['dataType'], littleEndian = false): number {
  let buf = buffer;
  if (littleEndian) {
    buf = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i += 2) {
      buf.writeUInt16LE(buffer.readUInt16BE(i), i);
    }
  }

  switch (dataType) {
    case 'int16':
      return buf.readInt16BE(0);
    case 'uint16':
      return buf.readUInt16BE(0);
    case 'int32':
      return buf.readInt32BE(0);
    case 'uint32':
      return buf.readUInt32BE(0);
    case 'float32':
      return buf.readFloatBE(0);
    case 'float64':
      return buf.readDoubleBE(0);
    default:
      return buf.readUInt16BE(0);
  }
}

export function applyScaleOffset(value: number, tag: Tag) {
  return value * tag.scale + tag.offset;
}

export function encodeRegisterValue(value: number, dataType: Tag['dataType']): Buffer {
  const length = registerLength(dataType);
  const buffer = Buffer.alloc(length * 2);
  switch (dataType) {
    case 'int16':
      buffer.writeInt16BE(value, 0);
      break;
    case 'uint16':
      buffer.writeUInt16BE(value, 0);
      break;
    case 'int32':
      buffer.writeInt32BE(value, 0);
      break;
    case 'uint32':
      buffer.writeUInt32BE(value, 0);
      break;
    case 'float32':
      buffer.writeFloatBE(value, 0);
      break;
    case 'float64':
      buffer.writeDoubleBE(value, 0);
      break;
    default:
      buffer.writeUInt16BE(value, 0);
  }
  return buffer;
}

export function bufferToUInt16Array(buffer: Buffer): number[] {
  const array: number[] = [];
  for (let i = 0; i < buffer.length; i += 2) {
    array.push(buffer.readUInt16BE(i));
  }
  return array;
}

