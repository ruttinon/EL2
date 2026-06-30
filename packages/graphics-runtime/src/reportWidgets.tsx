import React from 'react';
import type { RtWidgetContext } from './widgetRegistry';
import { applyBoxBorder } from './layoutShapes';

export function EnergySummaryWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass, valuesByTag, formatValue } = ctx;
  const sw = Number(obj.style?.strokeWidth ?? 1);
  const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#e2e8f0');
  const fill = String(obj.style?.fill ?? obj.style?.background ?? '#ffffff');

  // Read tags from style binding
  const tagActive = obj.style?.tagActive as string | undefined;
  const tagReactive = obj.style?.tagReactive as string | undefined;
  const tagApparent = obj.style?.tagApparent as string | undefined;

  const valActive = tagActive && valuesByTag ? valuesByTag.get(tagActive) : undefined;
  const valReactive = tagReactive && valuesByTag ? valuesByTag.get(tagReactive) : undefined;
  const valApparent = tagApparent && valuesByTag ? valuesByTag.get(tagApparent) : undefined;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '14px',
  };

  return (
    <div
      className={`rt-obj rt-energy-summary ${animClass}`}
      style={{
        ...applyBoxBorder(style, sw, stroke),
        background: fill,
        padding: '16px',
        color: '#334155',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '16px', color: '#0f172a' }}>
        {obj.name || 'Energy Summary'}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={rowStyle}>
          <span style={{ color: '#64748b' }}>Active Energy</span>
          <span style={{ fontWeight: 600, color: '#10b981' }}>{formatValue(valActive, 2)} kWh</span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: '#64748b' }}>Reactive Energy</span>
          <span style={{ fontWeight: 600, color: '#f59e0b' }}>{formatValue(valReactive, 2)} kVARh</span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={{ color: '#64748b' }}>Apparent Energy</span>
          <span style={{ fontWeight: 600, color: '#3b82f6' }}>{formatValue(valApparent, 2)} kVAh</span>
        </div>
      </div>
    </div>
  );
}

export function DemandSummaryWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass, valuesByTag, formatValue } = ctx;
  const sw = Number(obj.style?.strokeWidth ?? 1);
  const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#e2e8f0');
  const fill = String(obj.style?.fill ?? obj.style?.background ?? '#ffffff');

  const tagPeak = obj.style?.tagPeak as string | undefined;
  const tagPeakTime = obj.style?.tagPeakTime as string | undefined;

  const valPeak = tagPeak && valuesByTag ? valuesByTag.get(tagPeak) : undefined;
  const valPeakTime = tagPeakTime && valuesByTag ? valuesByTag.get(tagPeakTime) : undefined;

  return (
    <div
      className={`rt-obj rt-demand-summary ${animClass}`}
      style={{
        ...applyBoxBorder(style, sw, stroke),
        background: fill,
        padding: '16px',
        color: '#334155',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
        {obj.name || 'Peak Demand'}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444', lineHeight: 1 }}>
        {formatValue(valPeak, 2)}
        <span style={{ fontSize: '16px', marginLeft: '4px', color: '#94a3b8' }}>kW</span>
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', background: '#f8fafc', padding: '4px 12px', borderRadius: '12px' }}>
        {valPeakTime?.value ? String(valPeakTime.value) : '--:--'}
      </div>
    </div>
  );
}

export function PowerQualityWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass, valuesByTag, formatValue } = ctx;
  const sw = Number(obj.style?.strokeWidth ?? 1);
  const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#e2e8f0');
  const fill = String(obj.style?.fill ?? obj.style?.background ?? '#ffffff');

  const tagPf = obj.style?.tagPf as string | undefined;
  const tagThdv = obj.style?.tagThdv as string | undefined;
  const tagThdi = obj.style?.tagThdi as string | undefined;

  const valPf = tagPf && valuesByTag ? valuesByTag.get(tagPf) : undefined;
  const valThdv = tagThdv && valuesByTag ? valuesByTag.get(tagThdv) : undefined;
  const valThdi = tagThdi && valuesByTag ? valuesByTag.get(tagThdi) : undefined;

  return (
    <div
      className={`rt-obj rt-pq-summary ${animClass}`}
      style={{
        ...applyBoxBorder(style, sw, stroke),
        background: fill,
        padding: '16px',
        color: '#334155',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '16px', fontSize: '16px', color: '#0f172a' }}>
        {obj.name || 'Power Quality'}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flex: 1 }}>
        <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Power Factor</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#06b6d4' }}>{formatValue(valPf, 3)}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>THD (V)</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#8b5cf6' }}>{formatValue(valThdv, 1)}%</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>THD (I)</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#ec4899' }}>{formatValue(valThdi, 1)}%</div>
        </div>
      </div>
    </div>
  );
}

export function TouTableWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass, valuesByTag, formatValue } = ctx;
  const sw = Number(obj.style?.strokeWidth ?? 1);
  const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#e2e8f0');
  const fill = String(obj.style?.fill ?? obj.style?.background ?? '#ffffff');

  // Live tag bindings for TOU periods
  const tagPeak = obj.style?.tagPeak as string | undefined;
  const tagOffPeak = obj.style?.tagOffPeak as string | undefined;
  const tagHoliday = obj.style?.tagHoliday as string | undefined;
  const tagPeakRate = obj.style?.tagPeakRate as string | undefined;
  const tagOffPeakRate = obj.style?.tagOffPeakRate as string | undefined;
  const tagHolidayRate = obj.style?.tagHolidayRate as string | undefined;

  const valPeak = tagPeak && valuesByTag ? valuesByTag.get(tagPeak) : undefined;
  const valOffPeak = tagOffPeak && valuesByTag ? valuesByTag.get(tagOffPeak) : undefined;
  const valHoliday = tagHoliday && valuesByTag ? valuesByTag.get(tagHoliday) : undefined;
  const valPeakRate = tagPeakRate && valuesByTag ? valuesByTag.get(tagPeakRate) : undefined;
  const valOffPeakRate = tagOffPeakRate && valuesByTag ? valuesByTag.get(tagOffPeakRate) : undefined;
  const valHolidayRate = tagHolidayRate && valuesByTag ? valuesByTag.get(tagHolidayRate) : undefined;

  const peakKwh = typeof valPeak?.value === 'number' ? valPeak.value : null;
  const offPeakKwh = typeof valOffPeak?.value === 'number' ? valOffPeak.value : null;
  const holidayKwh = typeof valHoliday?.value === 'number' ? valHoliday.value : null;
  const peakRate = typeof valPeakRate?.value === 'number' ? valPeakRate.value : Number(obj.style?.peakRate ?? 4.1839);
  const offPeakRate = typeof valOffPeakRate?.value === 'number' ? valOffPeakRate.value : Number(obj.style?.offPeakRate ?? 2.6037);
  const holidayRate = typeof valHolidayRate?.value === 'number' ? valHolidayRate.value : Number(obj.style?.holidayRate ?? 2.6037);

  const fmt = (n: number | null, dp = 2) =>
    n == null || !Number.isFinite(n) ? 'โ€”' : n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

  const peakCost = peakKwh != null ? peakKwh * peakRate : null;
  const offPeakCost = offPeakKwh != null ? offPeakKwh * offPeakRate : null;
  const holidayCost = holidayKwh != null ? holidayKwh * holidayRate : null;

  const thStyle: React.CSSProperties = {
    padding: '8px',
    textAlign: 'left',
    borderBottom: '2px solid #e2e8f0',
    color: '#475569',
    fontWeight: 600,
    fontSize: '13px',
  };
  const tdStyle: React.CSSProperties = {
    padding: '8px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
    color: '#334155',
  };

  return (
    <div
      className={`rt-obj rt-tou-table ${animClass}`}
      style={{
        ...applyBoxBorder(style, sw, stroke),
        background: fill,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '16px', color: '#0f172a' }}>
        {obj.name || 'Time of Use (TOU)'}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Period</th>
              <th style={thStyle}>Time</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Energy (kWh)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Rate (เธฟ)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Cost (เธฟ)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><span style={{ display: 'inline-block', width: 8, height: 8, background: '#ef4444', borderRadius: '50%', marginRight: 6 }} />Peak</td>
              <td style={tdStyle}>09:00 โ€“ 22:00</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(peakKwh)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(peakRate, 4)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{fmt(peakCost)}</td>
            </tr>
            <tr>
              <td style={tdStyle}><span style={{ display: 'inline-block', width: 8, height: 8, background: '#10b981', borderRadius: '50%', marginRight: 6 }} />Off-Peak</td>
              <td style={tdStyle}>22:00 โ€“ 09:00</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(offPeakKwh)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(offPeakRate, 4)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(offPeakCost)}</td>
            </tr>
            <tr>
              <td style={tdStyle}><span style={{ display: 'inline-block', width: 8, height: 8, background: '#3b82f6', borderRadius: '50%', marginRight: 6 }} />Holiday</td>
              <td style={tdStyle}>All Day</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(holidayKwh)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(holidayRate, 4)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>{fmt(holidayCost)}</td>
            </tr>
            {(peakCost != null || offPeakCost != null || holidayCost != null) && (
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, borderTop: '2px solid #e2e8f0', color: '#0f172a' }}>Total</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, borderTop: '2px solid #e2e8f0', color: '#0f172a' }}>
                  {fmt((peakCost ?? 0) + (offPeakCost ?? 0) + (holidayCost ?? 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PageBreakWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass } = ctx;
  return (
    <div
      className={`rt-obj rt-page-break ${animClass}`}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '24px',
        borderTop: '2px dashed #f43f5e',
        borderBottom: '2px dashed #f43f5e',
        background: 'rgba(244, 63, 94, 0.05)',
        color: '#f43f5e',
        fontSize: '11px',
        fontWeight: 700,
        boxSizing: 'border-box',
        pageBreakAfter: 'always',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      [ PAGE BREAK โ€” เธ•เธฑเธ”เธซเธเนเธฒเธเธฃเธฐเธ”เธฒเธฉ ]
    </div>
  );
}

export function SectionWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass } = ctx;
  const sw = Number(obj.style?.strokeWidth ?? 1);
  const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#cbd5e1');
  const fill = String(obj.style?.fill ?? obj.style?.background ?? 'rgba(248, 250, 252, 0.5)');

  return (
    <div
      className={`rt-obj rt-section ${animClass}`}
      style={{
        ...applyBoxBorder(style, sw, stroke),
        background: fill,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px' }}>
        {obj.name || 'Section'}
      </div>
      <div style={{ flex: 1, fontSize: '13px', color: '#64748b' }}>
        {obj.text || ''}
      </div>
    </div>
  );
}

export function HeaderFooterWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass } = ctx;
  const isFooter = obj.style?.headerFooterType === 'footer';
  
  return (
    <div
      className={`rt-obj rt-header-footer ${animClass}`}
      style={{
        ...style,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#f8fafc',
        borderTop: isFooter ? '1px solid #cbd5e1' : 'none',
        borderBottom: isFooter ? 'none' : '1px solid #cbd5e1',
        fontSize: '12px',
        color: '#64748b',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, color: '#334155' }}>
        {obj.text || (isFooter ? 'Report System' : 'EnergyLink Monthly Report')}
      </div>
      <div>
        {isFooter ? 'เธซเธเนเธฒ 1 เธเธฒเธ 1' : new Date().toLocaleDateString('th-TH')}
      </div>
    </div>
  );
}

export function VariableWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass } = ctx;
  let val = obj.text || '{project_name}';
  
  // Replace standard tokens
  val = val.replace(/{project_name}/g, 'EnergyLink Main Site');
  val = val.replace(/{report_date}/g, new Date().toLocaleDateString('th-TH'));
  val = val.replace(/{author}/g, 'SCADA Operator');
  
  return (
    <div
      className={`rt-obj rt-variable ${animClass}`}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        fontSize: obj.style?.fontSize ? `${obj.style.fontSize}px` : '14px',
        color: obj.style?.color ? String(obj.style.color) : '#0f172a',
        fontWeight: 500,
        boxSizing: 'border-box',
      }}
    >
      {val}
    </div>
  );
}

export function QrCodeWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass } = ctx;
  const qrUrl = String(obj.style?.qrUrl ?? obj.text ?? 'https://energylink.co');
  
  return (
    <div
      className={`rt-obj rt-qrcode ${animClass}`}
      style={{
        ...style,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <svg viewBox="0 0 100 100" style={{ width: '80%', height: '80%', display: 'block' }}>
        <path d="M0,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z M70,0 h30 v30 h-30 z M80,10 h10 v10 h-10 z M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z M40,40 h20 v20 h-20 z M45,45 h10 v10 h-10 z" fill="#000000" />
        <path d="M40,0 h10 v10 h-10 z M60,10 h10 v10 h-10 z M40,20 h10 v10 h-10 z M0,40 h10 v10 h-10 z M20,50 h10 v10 h-10 z M50,50 h10 v10 h-10 z M90,40 h10 v10 h-10 z M80,60 h10 v10 h-10 z M70,80 h10 v10 h-10 z M90,90 h10 v10 h-10 z" fill="#000000" />
      </svg>
      <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
        {qrUrl}
      </span>
    </div>
  );
}

export function SignatureWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass } = ctx;
  
  return (
    <div
      className={`rt-obj rt-signature ${animClass}`}
      style={{
        ...style,
        background: '#ffffff',
        border: '1px dashed #cbd5e1',
        borderRadius: '6px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
        <svg viewBox="0 0 100 40" style={{ width: '80px', height: '30px' }}>
          <path d="M5,25 Q15,5 30,20 T60,15 T95,25" fill="none" stroke="#000000" strokeWidth="2.5" />
        </svg>
      </div>
      <div style={{ width: '80%', borderTop: '1px solid #94a3b8', marginTop: '8px', paddingTop: '4px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
        {obj.text || 'Approved By'}
      </div>
    </div>
  );
}

// โ”€โ”€ B2: MeterBillingWidget โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
export function MeterBillingWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass } = ctx;
  const sw = Number(obj.style?.strokeWidth ?? 1);
  const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#e2e8f0');
  const fill = String(obj.style?.fill ?? obj.style?.background ?? '#ffffff');

  // billingData: JSON string of MeterBillingRow[] injected at render time
  let rows: Array<{
    index: number; deviceName: string; tagName: string; meterNo: string;
    firstValue: number | null; lastValue: number | null;
    usageValue: number | null; ratePerUnit: number | null; amount: number | null; unit: string | null;
  }> = [];
  try {
    const raw = obj.style?.billingData;
    if (typeof raw === 'string' && raw.trim().startsWith('[')) {
      rows = JSON.parse(raw);
    }
  } catch { /* ignore bad JSON */ }

  const dp = Number(obj.style?.decimalPlaces ?? 2);
  const fmt = (n: number | null) =>
    n == null || !Number.isFinite(n) ? 'โ€”' : n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

  const totalUsage = rows.reduce((s, r) => s + (r.usageValue ?? 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  const thS: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' };
  const tdS: React.CSSProperties = { padding: '5px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', color: '#334155' };

  return (
    <div className={`rt-obj rt-meter-billing ${animClass}`} style={{ ...applyBoxBorder(style, sw, stroke), background: fill, padding: '16px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '15px', color: '#0f172a' }}>
        {obj.name || 'Meter Billing Table'}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thS, width: 32 }}>No.</th>
              <th style={thS}>Meter (Device)</th>
              <th style={thS}>Parameter</th>
              <th style={thS}>Meter No.</th>
              <th style={{ ...thS, textAlign: 'right' }}>Previous</th>
              <th style={{ ...thS, textAlign: 'right' }}>Current</th>
              <th style={{ ...thS, textAlign: 'right' }}>Used</th>
              <th style={{ ...thS, textAlign: 'right' }}>Rate</th>
              <th style={{ ...thS, textAlign: 'right' }}>Amount (เธฟ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} style={{ ...tdS, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: 20 }}>No billing data โ€” set billingData in style props</td></tr>
            ) : rows.map(r => (
              <tr key={r.index} style={{ background: r.index % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                <td style={{ ...tdS, textAlign: 'center', color: '#94a3b8' }}>{r.index}</td>
                <td style={{ ...tdS, fontWeight: 600 }}>{r.deviceName}</td>
                <td style={tdS}>{r.tagName}</td>
                <td style={{ ...tdS, color: '#64748b' }}>{r.meterNo || 'โ€”'}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>{fmt(r.firstValue)}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>{fmt(r.lastValue)}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>{fmt(r.usageValue)} {r.unit ?? ''}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>{fmt(r.ratePerUnit)}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f1f5f9' }}>
                <td colSpan={6} style={{ ...tdS, fontWeight: 700, borderTop: '2px solid #e2e8f0', color: '#0f172a' }}>เธฃเธงเธก / Total</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, borderTop: '2px solid #e2e8f0', color: '#0284c7' }}>{fmt(totalUsage)}</td>
                <td style={{ ...tdS, borderTop: '2px solid #e2e8f0' }} />
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, borderTop: '2px solid #e2e8f0', color: '#16a34a' }}>{fmt(totalAmount)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// โ”€โ”€ B3: CostSummaryWidget โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
export function CostSummaryWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, style, animClass, valuesByTag, formatValue } = ctx;
  const sw = Number(obj.style?.strokeWidth ?? 1);
  const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#e2e8f0');
  const fill = String(obj.style?.fill ?? obj.style?.background ?? '#ffffff');

  const tagKwh = obj.style?.tagKwh as string | undefined;
  const tagCost = obj.style?.tagCost as string | undefined;
  const tagPeak = obj.style?.tagPeakKw as string | undefined;
  const tagCarbon = obj.style?.tagCarbon as string | undefined;
  const tagRate = obj.style?.tagAvgRate as string | undefined;

  const get = (id?: string) => id && valuesByTag ? valuesByTag.get(id) : undefined;
  const numVal = (v: ReturnType<typeof get>) => typeof v?.value === 'number' ? v.value : null;

  const kwh = numVal(get(tagKwh));
  const cost = numVal(get(tagCost));
  const peak = numVal(get(tagPeak));
  const carbon = numVal(get(tagCarbon));
  const rate = numVal(get(tagRate));

  const fmt = (n: number | null, dp = 2, unit = '') =>
    n == null ? 'โ€”' : `${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}${unit ? ' ' + unit : ''}`;

  const cards: Array<{ label: string; value: string; color: string; icon: string }> = [
    { label: 'Total Energy', value: fmt(kwh, 2, 'kWh'), color: '#0284c7', icon: 'โก' },
    { label: 'Total Cost', value: fmt(cost, 2, 'เธฟ'), color: '#16a34a', icon: '๐’ฐ' },
    { label: 'Avg Rate', value: fmt(rate, 4, 'เธฟ/kWh'), color: '#d97706', icon: '๐“' },
    { label: 'Peak Demand', value: fmt(peak, 2, 'kW'), color: '#dc2626', icon: '๐“' },
    { label: 'Carbon', value: fmt(carbon, 3, 'tCOโ'), color: '#059669', icon: '๐ฟ' },
  ];

  return (
    <div className={`rt-obj rt-cost-summary ${animClass}`} style={{ ...applyBoxBorder(style, sw, stroke), background: fill, padding: '16px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ fontWeight: 700, marginBottom: '14px', fontSize: '15px', color: '#0f172a' }}>
        {obj.name || 'Cost & Energy Summary'}
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1, alignContent: 'flex-start' }}>
        {cards.map(c => (
          <div key={c.label} style={{
            flex: '1 1 140px', background: '#f8fafc', borderRadius: '10px',
            padding: '12px 14px', border: `1px solid ${c.color}22`,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{c.icon}</span>{c.label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: c.color, lineHeight: 1.2 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
