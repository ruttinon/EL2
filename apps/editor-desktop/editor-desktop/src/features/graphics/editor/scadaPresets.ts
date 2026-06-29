/** Standard SCADA equipment states for status / multistate widgets. */
export const SCADA_STATE_SLOTS = [
  { value: 0, label: 'Stopped', color: '#64748b' },
  { value: 1, label: 'Running', color: '#22c55e' },
  { value: 2, label: 'Fault', color: '#ef4444' },
  { value: 3, label: 'Comm Fail', color: '#f97316' },
] as const;

export const SCADA_STATE_SLOTS_JSON = JSON.stringify(SCADA_STATE_SLOTS);

export const SCADA_BADGE_MAP =
  '0:Stopped:#64748b,1:Running:#22c55e,2:Fault:#ef4444,3:Comm Fail:#f97316';

export const SCADA_STATES_LABELS = SCADA_STATE_SLOTS.map((s) => s.label).join(',');
