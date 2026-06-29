import React from 'react';
import type { ReportObjectDefinition } from '@energylink/shared-types';
import type { TrendPoint } from '@energylink/graphics-runtime';
import { mergeStyle } from '../graphics/editor/inspector/inspectorUtils';
import {
  REPORT_CHART_PERIOD_OPTIONS,
  REPORT_CHART_VIEW_MODES,
  REPORT_SAMPLE_DENSITY,
} from './reportPreviewRuntime';

type Props = {
  object: ReportObjectDefinition;
  onPatch: (patch: Partial<ReportObjectDefinition>) => void;
};

export function ReportChartSettings({ object, onPatch }: Props) {
  const style = object.style ?? {};
  const period = String(style.period ?? style.chartPeriod ?? '24h');
  const viewMode = String(style.reportViewMode ?? 'line');
  const samplePoints = String(style.reportSamplePoints ?? style.chartPoints ?? '24');

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onPatch({ style: mergeStyle(object, patch) });
  };

  const applyPeriod = (value: string) => {
    setStyle({ period: value, chartPeriod: value });
  };

  const applyViewMode = (value: string) => {
    const patch: Record<string, string> = { reportViewMode: value };
    if (value === 'area') {
      patch.echartType = object.type === 'echart' ? 'area' : (String(style.echartType ?? 'line'));
    } else if (value === 'points' && object.type === 'echart') {
      patch.echartType = 'line';
      patch.reportPointMarkers = 'true';
    } else if (value === 'line') {
      patch.reportPointMarkers = 'false';
      if (object.type === 'echart') patch.echartType = 'line';
    }
    onPatch({ style: mergeStyle(object, patch) });
  };

  return (
    <section className="ins-sec ins-sec-premium">
      <div className="ins-sec-head"><h4>กราฟ / ข้อมูล</h4></div>

      <label className="ins-row">
        <span>ช่วงเวลา</span>
        <select value={period} onChange={(e) => applyPeriod(e.target.value)}>
          {REPORT_CHART_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      <label className="ins-row">
        <span>ความถี่จุด</span>
        <select
          value={samplePoints}
          onChange={(e) => setStyle({ reportSamplePoints: Number(e.target.value), chartPoints: Number(e.target.value) })}
        >
          {REPORT_SAMPLE_DENSITY.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      <label className="ins-row">
        <span>รูปแบบแสดงผล</span>
        <select value={viewMode} onChange={(e) => applyViewMode(e.target.value)}>
          {REPORT_CHART_VIEW_MODES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      {object.type === 'echart' ? (
        <label className="ins-row">
          <span>ชนิดกราฟ</span>
          <select
            value={String(style.echartType ?? 'line')}
            onChange={(e) => setStyle({ echartType: e.target.value })}
          >
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="bar">Column</option>
            <option value="bar-h">Bar</option>
            <option value="pie">Pie</option>
            <option value="donut">Donut</option>
          </select>
        </label>
      ) : null}
    </section>
  );
}

export function ReportTrendTablePreview({
  title,
  points,
  unit,
}: {
  title?: string;
  points: TrendPoint[];
  unit?: string;
}) {
  const rows = points.slice(-48);
  return (
    <div className="report-trend-table-preview" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {title ? <div style={{ fontWeight: 600, fontSize: 12, padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>{title}</div> : null}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="rt-table" style={{ width: '100%', fontSize: 11 }}>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ค่า{unit ? ` (${unit})` : ''}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={2} className="rt-table-empty">ยังไม่มีข้อมูล</td></tr>
            ) : rows.map((p) => (
              <tr key={p.readAt}>
                <td>{new Date(p.readAt).toLocaleString()}</td>
                <td>{p.value != null && p.value !== undefined ? Number(p.value).toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
