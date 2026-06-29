function parseRgbChannel(value: string): number | null {
  const n = Number(value.trim());
  return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Normalize values for `<input type="color">` — browsers only accept #rrggbb. */
export function hexForColorInput(value: unknown, fallback = '#ffffff'): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === 'transparent') return fallback;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgba = raw.match(/^rgba?\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^,)]+)/i);
  if (rgba) {
    const r = parseRgbChannel(rgba[1]);
    const g = parseRgbChannel(rgba[2]);
    const b = parseRgbChannel(rgba[3]);
    if (r != null && g != null && b != null) return rgbToHex(r, g, b);
  }
  return fallback;
}
