import type { CurrentTagValue } from '../types/monitor';
import { normalizeQuality } from './runtimeQuality';

export function calculateTotalPower(values: CurrentTagValue[]): number {
  const sumTags = values.filter(v => {
    const name = String(v.name).toLowerCase();
    const unit = String(v.unit ?? '').toLowerCase();
    return unit === 'kw' && (name.includes('sum') || name.includes('total'));
  });
  if (sumTags.length > 0) {
    return sumTags.reduce((s, v) => s + (Number(v.value) || 0), 0);
  }
  return values
    .filter(v => String(v.unit ?? '').toLowerCase() === 'kw')
    .reduce((s, v) => s + (Number(v.value) || 0), 0);
}

export function computeEnergyKwh(values: CurrentTagValue[]): number {
  return values.reduce((sum, v) => {
    const unit = String(v.unit ?? '').toLowerCase();
    const name = String(v.name ?? '').toLowerCase();
    if (unit === 'kwh' || name.includes('energy') || name.includes('kwh')) {
      return sum + (Number(v.value) || 0);
    }
    return sum;
  }, 0);
}

export function commQualityPercent(values: CurrentTagValue[]): number {
  if (values.length === 0) return 0;
  const good = values.filter(v => normalizeQuality(v.quality) === 'good').length;
  return Math.round((good / values.length) * 100);
}
