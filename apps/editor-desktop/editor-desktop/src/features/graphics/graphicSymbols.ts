import type { GraphicSymbol } from '@energylink/shared-types';
import { GRAPHIC_SYMBOLS_STORAGE_KEY } from '@energylink/shared-types';

export { GRAPHIC_SYMBOLS_STORAGE_KEY };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadGraphicSymbols(): GraphicSymbol[] {
  return loadJson<GraphicSymbol[]>(GRAPHIC_SYMBOLS_STORAGE_KEY, []);
}

export function saveGraphicSymbols(symbols: GraphicSymbol[]) {
  saveJson(GRAPHIC_SYMBOLS_STORAGE_KEY, symbols);
}

export async function readSvgFile(file: File): Promise<string> {
  const text = await file.text();
  if (text.trim().startsWith('<svg')) return text.trim();
  throw new Error('File must contain valid SVG markup.');
}

export function symbolById(symbols: GraphicSymbol[], id: string): GraphicSymbol | undefined {
  return symbols.find((s) => s.id === id);
}

/** Built-in starter symbols for Phase 13 */
export const BUILTIN_SYMBOLS: GraphicSymbol[] = [
  {
    id: 'builtin_door',
    name: 'Door',
    svgContent: '<svg viewBox="0 0 64 64"><rect x="10" y="8" width="44" height="48" fill="none" stroke="#173047" stroke-width="2"/><line x1="32" y1="56" x2="32" y2="32" stroke="#173047" stroke-width="2"/></svg>',
    viewBox: '0 0 64 64',
    createdAt: new Date(0).toISOString(),
  },
  {
    id: 'builtin_lamp',
    name: 'Lamp',
    svgContent: '<svg viewBox="0 0 64 64"><circle cx="32" cy="28" r="14" fill="#facc15" stroke="#f59e0b" stroke-width="2"/><rect x="26" y="42" width="12" height="10" fill="#64748b"/></svg>',
    viewBox: '0 0 64 64',
    createdAt: new Date(0).toISOString(),
  },
];

export function allSymbols(): GraphicSymbol[] {
  const custom = loadGraphicSymbols();
  const ids = new Set(custom.map((s) => s.id));
  return [...custom, ...BUILTIN_SYMBOLS.filter((b) => !ids.has(b.id))];
}

/** Tool key used by the graphics editor palette for a library symbol. */
export function symbolToolKey(symbolId: string): string {
  return `symbol:${symbolId}`;
}

/** Import an SVG file into the local symbol library (Setup → Symbols storage). */
export async function importSvgToLibrary(file: File): Promise<GraphicSymbol> {
  const svgContent = await readSvgFile(file);
  const name = file.name.replace(/\.svg$/i, '').trim() || 'Symbol';
  const id = `sym_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const sym: GraphicSymbol = { id, name, svgContent, createdAt: new Date().toISOString() };
  saveGraphicSymbols([...loadGraphicSymbols(), sym]);
  return sym;
}
