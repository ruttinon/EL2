export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = status?.toLowerCase() ?? 'unknown';
  const text = label ?? (cls === 'good' ? 'Valid' : cls === 'bad' ? 'Invalid' : status);
  return <span className={`status-badge ${cls}`}>{text}</span>;
}
