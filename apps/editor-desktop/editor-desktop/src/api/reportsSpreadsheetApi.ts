import { getEngineUrl } from '@energylink/shared-ui';
import type { ReportSummary } from '@energylink/shared-types';

type SpreadsheetCellStyle = {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string;
  color?: string;
};

export type SpreadsheetCellSnapshot = {
  address: string;
  row: number;
  col: number;
  display: string;
  raw?: string | number | boolean | null;
  style?: SpreadsheetCellStyle;
};

export type SpreadsheetSheetSnapshot = {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  usedRange: string;
  columns: Array<{ index: number; width: number }>;
  merges: string[];
  cells: SpreadsheetCellSnapshot[];
};

export type SpreadsheetPreviewResult = {
  mode: 'spreadsheet';
  range: {
    from: string;
    to: string;
    label: string;
  };
  source: {
    historyCount: number;
    alarmCount: number;
  };
  sheets: SpreadsheetSheetSnapshot[];
  warnings: string[];
};

export type SpreadsheetTemplateImportInput = {
  filename: string;
  dataBase64: string;
  kind: 'xlsx' | 'csv';
};

export type SpreadsheetPreviewRequest = {
  from?: string;
  to?: string;
  tariffId?: string;
};

export type SpreadsheetTemplateImportResult = {
  report: ReportSummary;
  preview: SpreadsheetPreviewResult;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${getEngineUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, message: typeof data?.message === 'string' ? data.message : `HTTP ${response.status}` };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export const reportsSpreadsheetApi = {
  importTemplate: (
    reportId: string,
    body: SpreadsheetTemplateImportInput,
  ) =>
    requestJson<SpreadsheetTemplateImportResult>(
      `/api/reports/${encodeURIComponent(reportId)}/import-spreadsheet`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  resolvePreview: (
    reportId: string,
    body: SpreadsheetPreviewRequest,
  ) =>
    requestJson<{ preview: SpreadsheetPreviewResult }>(
      `/api/reports/${encodeURIComponent(reportId)}/resolve-spreadsheet-preview`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
};
