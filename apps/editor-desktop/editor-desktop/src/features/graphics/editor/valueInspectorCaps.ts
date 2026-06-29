import type { ValueStateRule, WidgetStateSlot } from '@energylink/graphics-runtime';

export type ValueDisplayModeOption = 'classic' | 'image' | 'model3d';

export type RuleFieldCaps = {
  fill: boolean;
  color: boolean;
  text: boolean;
  image: boolean;
  glb: boolean;
};

export type ValueInspectorCaps = {
  designTitle: string;
  designHint: string;
  displayModes: ValueDisplayModeOption[];
  showVariants: boolean;
  showBinaryStates: boolean;
  showGlow: boolean;
  showStateSlots: boolean;
  stateSlotsTitle: string;
  stateSlotsHint: string;
  showValueRules: boolean;
  valueRulesTitle: string;
  valueRulesHint: string;
  defaultRule: ValueStateRule;
  ruleFields: RuleFieldCaps;
  ruleWhenOptions?: ValueStateRule['when'][];
  hideGenericEffects: boolean;
  effectsHint: string;
};

const NUMERIC_WHEN: ValueStateRule['when'][] = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between',
];

const DISCRETE_WHEN: ValueStateRule['when'][] = ['eq', 'gte', 'between', 'on', 'off'];

const RULE_ALL: RuleFieldCaps = { fill: true, color: true, text: true, image: true, glb: true };
const RULE_BAR: RuleFieldCaps = { fill: true, color: false, text: false, image: true, glb: false };
const RULE_NUMERIC: RuleFieldCaps = { fill: true, color: true, text: false, image: true, glb: false };
const RULE_TEXT: RuleFieldCaps = { fill: true, color: true, text: true, image: true, glb: true };

export const VALUE_INSPECTOR_CAPS: Partial<Record<string, ValueInspectorCaps>> = {
  led: {
    designTitle: 'LED — Status Light',
    designHint: 'Circle · Image · 3D Model toggles based on ON/OFF',
    displayModes: ['classic', 'image', 'model3d'],
    showVariants: false,
    showBinaryStates: true,
    showGlow: true,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Special Rules',
    valueRulesHint: 'Overrides ON/OFF when tag meets condition (e.g., blink on fault)',
    defaultRule: { when: 'on', background: '#22c55e' },
    ruleFields: { fill: true, color: false, text: false, image: true, glb: true },
    ruleWhenOptions: ['on', 'off', 'eq'],
    hideGenericEffects: true,
    effectsHint: 'Use rules above instead — Animation is for rotation/movement only',
  },
  status: {
    designTitle: 'Status — Appearance',
    designHint: 'Color · Image · 3D Model toggles based on ON/OFF — Does not have to be a circle',
    displayModes: ['classic', 'image', 'model3d'],
    showVariants: false,
    showBinaryStates: true,
    showGlow: true,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Special Rules',
    valueRulesHint: 'Overrides ON/OFF when tag meets condition',
    defaultRule: { when: 'on', background: '#22c55e' },
    ruleFields: { fill: true, color: false, text: false, image: true, glb: true },
    ruleWhenOptions: ['on', 'off', 'eq'],
    hideGenericEffects: true,
    effectsHint: '',
  },
  value: {
    designTitle: 'Value — Appearance',
    designHint: 'Bind Tag in Data Binding · Click Live to see actual values',
    displayModes: ['classic', 'image'],
    showVariants: true,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: false,
    valueRulesTitle: '',
    valueRulesHint: '',
    defaultRule: { when: 'gte', value: 80, background: '#fee2e2', color: '#b91c1c' },
    ruleFields: RULE_NUMERIC,
    ruleWhenOptions: NUMERIC_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  gauge: {
    designTitle: 'Gauge — Style',
    designHint: 'Needle + Card style or image background',
    displayModes: ['classic', 'image'],
    showVariants: true,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Value Range / Needle Color',
    valueRulesHint: 'Change needle or background color when value meets condition',
    defaultRule: { when: 'between', min: 70, max: 100, color: '#ef4444' },
    ruleFields: { fill: true, color: true, text: false, image: true, glb: false },
    ruleWhenOptions: NUMERIC_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  progressbar: {
    designTitle: 'Progress Bar',
    designHint: 'Image mode = Image inside bar fills by % · Rules change bar color/image',
    displayModes: ['classic', 'image'],
    showVariants: false,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Bar Color by Value',
    valueRulesHint: 'e.g. = 100 → Green · < 30 → Red',
    defaultRule: { when: 'gte', value: 100, fill: '#16a34a' },
    ruleFields: RULE_BAR,
    ruleWhenOptions: NUMERIC_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  levelbar: {
    designTitle: 'Level Bar (Vertical)',
    designHint: 'Bar/Track Color · Image mode = Image fills by value',
    displayModes: ['classic', 'image'],
    showVariants: false,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Bar Color by Level',
    valueRulesHint: 'e.g. ≥ 90 → Dark Blue · ≤ 10 → Gray',
    defaultRule: { when: 'gte', value: 90, fill: '#0891b2' },
    ruleFields: RULE_BAR,
    ruleWhenOptions: NUMERIC_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  slider: {
    designTitle: 'Slider',
    designHint: 'Continuous value adjustment — color can be based on value range',
    displayModes: ['classic'],
    showVariants: false,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Color by Value Range',
    valueRulesHint: 'e.g. ≥ 80 → Orange · ≤ 20 → Gray',
    defaultRule: { when: 'gte', value: 80, fill: '#f97316' },
    ruleFields: RULE_BAR,
    ruleWhenOptions: NUMERIC_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  semaphore: {
    designTitle: 'Semaphore',
    designHint: '0=Green 1=Yellow 2+=Red · Set color/image for each state below',
    displayModes: ['classic', 'image', 'model3d'],
    showVariants: false,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: true,
    stateSlotsTitle: 'Light States (0 / 1 / 2+)',
    stateSlotsHint: 'Each tag value displays the color or image/model for that state',
    showValueRules: true,
    valueRulesTitle: 'Additional Rules',
    valueRulesHint: 'Overrides normal states for special cases',
    defaultRule: { when: 'eq', value: 2, background: '#7f1d1d' },
    ruleFields: RULE_TEXT,
    ruleWhenOptions: DISCRETE_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  multistate: {
    designTitle: 'Multistate',
    designHint: 'Text/Color/Image per value 0,1,2…',
    displayModes: ['classic', 'image', 'model3d'],
    showVariants: true,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: true,
    stateSlotsTitle: 'State List',
    stateSlotsHint: 'Tag value = Left number · Label/Color/Image per state',
    showValueRules: true,
    valueRulesTitle: 'Rules Override States',
    valueRulesHint: 'Use to temporarily override',
    defaultRule: { when: 'eq', value: 0, text: 'Stopped', background: '#94a3b8' },
    ruleFields: RULE_TEXT,
    ruleWhenOptions: DISCRETE_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  statusbadge: {
    designTitle: 'Status Badge',
    designHint: 'Text · Image · 3D Model per state (Online/Offline/Fault)',
    displayModes: ['classic', 'image', 'model3d'],
    showVariants: false,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: true,
    stateSlotsTitle: 'States (Tag value → Appearance)',
    stateSlotsHint: 'e.g. 0=Offline, 1=Online — Upload image or GLB per state',
    showValueRules: true,
    valueRulesTitle: 'Rules Override Badge',
    valueRulesHint: 'Special cases to override states above',
    defaultRule: { when: 'eq', value: 1, background: '#22c55e', text: 'Online' },
    ruleFields: RULE_TEXT,
    ruleWhenOptions: DISCRETE_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  kpicard: {
    designTitle: 'KPI Card',
    designHint: 'Image mode = Full card background · Delta is configured in KPI section',
    displayModes: ['classic', 'image'],
    showVariants: true,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Card Color by KPI',
    valueRulesHint: 'e.g. KPI < 0 → Red background',
    defaultRule: { when: 'lt', value: 0, background: '#fee2e2' },
    ruleFields: { fill: true, color: true, text: false, image: true, glb: false },
    ruleWhenOptions: NUMERIC_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
  formulavalue: {
    designTitle: 'Formula Value',
    designHint: 'Expression set in Formula section · Image mode = Background',
    displayModes: ['classic', 'image'],
    showVariants: true,
    showBinaryStates: false,
    showGlow: false,
    showStateSlots: false,
    stateSlotsTitle: '',
    stateSlotsHint: '',
    showValueRules: true,
    valueRulesTitle: 'Result Color by Value',
    valueRulesHint: 'Change number color when result meets condition',
    defaultRule: { when: 'gte', value: 100, color: '#16a34a' },
    ruleFields: { fill: true, color: true, text: false, image: true, glb: false },
    ruleWhenOptions: NUMERIC_WHEN,
    hideGenericEffects: true,
    effectsHint: '',
  },
};

export function getValueInspectorCaps(type: string, style?: Record<string, unknown>): ValueInspectorCaps | null {
  if (type === 'status' && style?.statusVariant === 'badge') return null;
  const caps = VALUE_INSPECTOR_CAPS[type];
  if (!caps) return null;
  return { ...caps, designHint: caps.designHint, stateSlotsHint: caps.stateSlotsHint ?? '', valueRulesHint: caps.valueRulesHint ?? '', effectsHint: caps.effectsHint ?? '' };
}

export function valueRuleWhenOptions(caps: ValueInspectorCaps): ValueStateRule['when'][] {
  return caps.ruleWhenOptions ?? NUMERIC_WHEN;
}

export const VALUE_FORMAT_TYPES = new Set([
  'value', 'gauge', 'progressbar', 'levelbar', 'slider', 'formulavalue', 'kpicard',
]);

export const VALUE_RULE_WHEN_LABELS: Record<ValueStateRule['when'], string> = {
  on: 'ON (1/true)',
  off: 'OFF (0/false)',
  eq: 'Equal (=)',
  neq: 'Not equal (!=)',
  gt: 'Greater than (>)',
  gte: 'Greater or equal (>=)',
  lt: 'Less than (<)',
  lte: 'Less or equal (<=)',
  between: 'Between',
};

export const DEFAULT_STATE_SLOTS: Partial<Record<string, WidgetStateSlot[]>> = {
  statusbadge: [
    { value: 0, label: 'Offline', color: '#94a3b8' },
    { value: 1, label: 'Online', color: '#22c55e' },
    { value: 2, label: 'Fault', color: '#ef4444' },
  ],
  multistate: [
    { value: 0, label: 'Stopped', color: '#94a3b8' },
    { value: 1, label: 'Running', color: '#22c55e' },
    { value: 2, label: 'Fault', color: '#ef4444' },
  ],
  semaphore: [
    { value: 0, label: 'Normal', color: '#22c55e' },
    { value: 1, label: 'Warning', color: '#f59e0b' },
    { value: 2, label: 'Danger', color: '#ef4444' },
  ],
};
