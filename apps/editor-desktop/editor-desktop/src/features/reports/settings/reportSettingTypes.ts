export type ReportToolSettingFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'boolean'
  | 'color'
  | 'tagPicker'
  | 'multiTagPicker'
  | 'devicePicker'
  | 'meterPicker'
  | 'date'
  | 'folderPicker'
  | 'columnBuilder'
  | 'formulaEditor';

export type ReportToolSettingFieldOption = {
  label: string;
  value: string | number | boolean;
  hint?: string;
};

export type ReportToolSettingField = {
  key: string;
  label: string;
  type: ReportToolSettingFieldType;
  defaultValue?: unknown;
  options?: ReportToolSettingFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  visibleWhen?: Record<string, unknown>;
  description?: string;
  multiple?: boolean;
};

export type ReportToolSettingsSchema = {
  toolType: string;
  general?: ReportToolSettingField[];
  style?: ReportToolSettingField[];
  binding?: ReportToolSettingField[];
  calculation?: ReportToolSettingField[];
  data?: ReportToolSettingField[];
  table?: ReportToolSettingField[];
  chart?: ReportToolSettingField[];
  billing?: ReportToolSettingField[];
  behavior?: ReportToolSettingField[];
  export?: ReportToolSettingField[];
  advanced?: ReportToolSettingField[];
};

export type ReportToolSettingsRegistry = Record<string, ReportToolSettingsSchema>;
