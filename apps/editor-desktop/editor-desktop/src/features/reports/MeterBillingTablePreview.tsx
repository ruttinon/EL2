import React from 'react';
import type { ReportObjectDefinition } from '@energylink/shared-types';
import {
  formatMeterCell,
  meterBillingColumnLabel,
  parseMeterBillingColumns,
  type MeterBillingRow,
} from '@energylink/shared-types';

type Props = {
  object: ReportObjectDefinition;
  rows: MeterBillingRow[];
  loading?: boolean;
};

export function MeterBillingTablePreview({ object, rows, loading }: Props) {
  const style = object.style ?? {};
  const columns = parseMeterBillingColumns(object.props?.columns);
  const showHeader = object.props?.showHeader !== false;
  const fontSize = typeof style.fontSize === 'number' ? style.fontSize : 11;
  const color = typeof style.color === 'string' ? style.color : '#0f172a';
  const headerBg = typeof style.headerBackground === 'string' ? style.headerBackground : '#f1f5f9';
  const borderColor = typeof style.borderColor === 'string' ? style.borderColor : '#cbd5e1';
  const dp = typeof style.decimalPlaces === 'number'
    ? style.decimalPlaces
    : (typeof object.props?.decimal === 'number' ? object.props.decimal : 2);

  if (loading && rows.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, color: '#94a3b8' }}>
        โหลด…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, color: '#94a3b8', padding: 12 }}>
        ไม่มีมิเตอร์
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', width: '100%', fontSize, color }}>
      <table className="meter-billing-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        {showHeader ? (
          <thead>
            <tr style={{ background: headerBg }}>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    border: `1px solid ${borderColor}`,
                    padding: '4px 6px',
                    textAlign: col === 'index' ? 'center' : 'left',
                    fontWeight: 700,
                    fontSize: fontSize * 0.9,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {meterBillingColumnLabel(col, 'th')}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row) => (
            <tr key={row.tagId}>
              {columns.map((col) => (
                <td
                  key={col}
                  style={{
                    border: `1px solid ${borderColor}`,
                    padding: '3px 6px',
                    textAlign: ['index', 'first', 'last', 'usage', 'rate', 'amount'].includes(col) ? 'right' : 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {formatMeterCell(col, row, dp)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
