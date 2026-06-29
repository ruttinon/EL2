export function qualityLabel(value?: string | boolean | number | null) {
  const text = value === true ? 'OK' : value === false ? 'NO' : String(value ?? 'unknown');
  const lower = text.toLowerCase();
  if (lower === 'good') return 'Valid';
  if (lower === 'bad') return 'Invalid';
  if (lower === 'uncertain' || lower === 'warn' || lower === 'warning') return 'Uncertain';
  if (lower === 'unknown') return 'Unknown';
  return text;
}

export function StatusBadge({ value }: { value?: string | boolean | number | null }) {
  const text = value === true ? 'OK' : value === false ? 'NO' : String(value ?? 'unknown');
  const lower = text.toLowerCase();
  const cls =
    lower.includes('good') || lower.includes('online') || lower.includes('ok') || lower.includes('running')
      ? 'good'
      : lower.includes('bad') || lower.includes('offline') || lower.includes('error') || lower.includes('failed') || lower.includes('critical')
        ? 'bad'
        : lower.includes('warn') || lower.includes('uncertain')
          ? 'warn'
          : 'unknown';
  return <span className={`badge ${cls}`}>{qualityLabel(value)}</span>;
}
