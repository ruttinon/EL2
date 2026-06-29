import { XMLParser } from 'fast-xml-parser';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface XgmbVariable {
  guid: string;
  id: string;
  name: string;
  description: string;
  units: string;
  type: 'NUMERIC' | 'BINARY';
  initAddress: number;
  registers: number;
  functionCode: number;
  functionWriteCode: number;
  dataType: string;
  scale: number;
  decimalPlaces: number;
  decimals: number;
}

export interface XgmbConfig {
  maxRegisters: number;
  littleEndianData: boolean;
  swapRegisterBytes: boolean;
  variables: XgmbVariable[];
}

export async function parseXgmbFile(filePath: string): Promise<XgmbConfig> {
  const xmlData = await fs.readFile(filePath, 'utf-8');
  return parseXgmbContent(xmlData);
}

export function parseXgmbContent(xmlData: string): XgmbConfig {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
  });

  const jsonObj = parser.parse(xmlData);
  const main = jsonObj.main;

  if (!main) {
    throw new Error('Invalid XGMB file: Missing <main> tag');
  }

  const variables: XgmbVariable[] = [];
  const rawVars = main.variables?.variable;

  if (rawVars) {
    const varList = Array.isArray(rawVars) ? rawVars : [rawVars];
    for (const v of varList) {
      const dataType = mapXgmbDataType(v);
      const decimals = Number(v.decimals || 0);
      variables.push({
        guid: String(v.guid || ''),
        id: String(v.id || ''),
        name: String(v.name || ''),
        description: String(v.description || ''),
        units: String(v.units || '').replace(/^#/, ''),
        type: String(v.type).toUpperCase() as 'NUMERIC' | 'BINARY',
        initAddress: Number(v.initAddress || 0),
        registers: Math.max(Number(v.registers || 1), registerLengthForDataType(dataType)),
        functionCode: Number(v.functionCode || 3),
        functionWriteCode: Number(v.functionWriteCode || 16),
        dataType,
        scale: scaleFromDecimals(decimals),
        decimalPlaces: decimals,
        decimals,
      });
    }
  }

  return {
    maxRegisters: Number(main.maxRegisters || 120),
    littleEndianData: main.littleEndianData === 'T',
    swapRegisterBytes: main.swapRegisterBytes === 'T',
    variables,
  };
}

function registerLengthForDataType(dataType: string): number {
  if (dataType === 'int32' || dataType === 'uint32' || dataType === 'float32') return 2;
  if (dataType === 'float64') return 4;
  return 1;
}

function scaleFromDecimals(decimals: number): number {
  if (!Number.isInteger(decimals) || decimals <= 0) return 1;
  return 1 / Math.pow(10, Math.min(decimals, 12));
}

function mapXgmbDataType(v: any): string {
  if (v.iee754 === 'T') return 'float32';
  if (v.registers === 2) {
    return v.sign === 'T' ? 'int32' : 'uint32';
  }
  if (v.registers === 1) {
    return v.sign === 'T' ? 'int16' : 'uint16';
  }
  return 'uint16';
}
