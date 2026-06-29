import React from 'react';
import { Icon } from '@iconify/react';
import { billingApi, type BillingSummaryResponse, type TariffSummary } from '../../api/billingApi';
import type { TariffMode } from '@energylink/shared-types';
import { useModal } from '../../context/ModalContext';
import { TariffEditorModal } from './TariffEditorModal';

type BillingPanelProps = {
  projectId?: string | null;
};

const PERIODS: Array<{ id: 'live' | 'today' | '7d' | '30d'; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'live', label: 'Live meters' },
];

function money(n: number, currency = 'THB') {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function BillingPanel({ projectId }: BillingPanelProps) {
  const { showConfirm } = useModal();
  const [tariffs, setTariffs] = React.useState<TariffSummary[]>([]);
  const [selectedTariffId, setSelectedTariffId] = React.useState('');
  const [period, setPeriod] = React.useState<'live' | 'today' | '7d' | '30d'>('30d');
  const [bill, setBill] = React.useState<BillingSummaryResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingTariff, setEditingTariff] = React.useState<TariffSummary | null>(null);

  const refreshTariffs = React.useCallback(async () => {
    const res = await billingApi.listTariffs(projectId ?? undefined);
    if (res.ok) {
      setTariffs(res.data.tariffs);
      setSelectedTariffId((prev) => {
        if (prev && res.data.tariffs.some((t) => t.id === prev)) return prev;
        return (res.data.tariffs.find((t) => t.isDefault) ?? res.data.tariffs[0])?.id ?? '';
      });
    }
  }, [projectId]);

  React.useEffect(() => {
    void refreshTariffs();
  }, [refreshTariffs]);

  const runSimulate = async () => {
    setBusy(true);
    setMessage(null);
    const res = await billingApi.simulate({
      projectId: projectId ?? undefined,
      period,
      tariffId: selectedTariffId || undefined,
    });
    setBusy(false);
    if ('message' in res) {
      setMessage(res.message);
      return;
    }
    setBill(res.data);
  };

  const openCreate = () => {
    setEditingTariff(null);
    setEditorOpen(true);
  };

  const openEdit = (tariff: TariffSummary) => {
    setEditingTariff(tariff);
    setEditorOpen(true);
  };

  const handleDelete = async (tariff: TariffSummary) => {
    if (!await showConfirm(`ลบ Tariff "${tariff.name}"?`)) return;
    const res = await billingApi.deleteTariff(tariff.id);
    if ('message' in res) {
      setMessage(res.message);
      return;
    }
    await refreshTariffs();
    setMessage(null);
  };

  const selectedTariff = tariffs.find((t) => t.id === selectedTariffId);

  return (
    <div className="billing-panel">
      <div className="billing-toolbar">
        <div className="billing-toolbar-left">
          <h3><Icon icon="solar:bill-list-bold-duotone" width={22} /> Energy Billing &amp; Bill Simulation</h3>
          <p className="billing-sub">คำนวณค่าไฟแบบ Flat / Block tier / TOU / Demand — จัดการ Tariff และจำลองบิล</p>
        </div>
        <div className="billing-toolbar-right" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#5b6b7b', textTransform: 'uppercase' }}>Select Tariff</span>
            <select value={selectedTariffId} onChange={(e) => setSelectedTariffId(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c9dbe2', background: '#fff' }}>
              {tariffs.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' ★' : ''}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#5b6b7b', textTransform: 'uppercase' }}>Period</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c9dbe2', background: '#fff' }}>
              {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <button className="btn primary" disabled={busy} onClick={() => void runSimulate()} style={{ height: 36, alignSelf: 'flex-end', padding: '0 16px' }}>
            <Icon icon="solar:calculator-minimalistic-bold-duotone" width="16" style={{ marginRight: 6, verticalAlign: 'middle', color: '#fff' }} />
            {busy ? 'Calculating…' : 'Simulate Bill'}
          </button>
        </div>
      </div>

      {message ? <div className="billing-msg billing-msg-err">{message}</div> : null}

      {selectedTariff ? (
        <div className="billing-tariff-info">
          <span className="billing-pill">{selectedTariff.config.mode.toUpperCase()}</span>
          <span>{selectedTariff.description ?? selectedTariff.name}</span>
          {selectedTariff.config.mode === 'flat' ? (
            <span>Rate: {selectedTariff.config.flatRatePerKwh} THB/kWh</span>
          ) : null}
          <button type="button" className="btn-link" onClick={() => openEdit(selectedTariff)}>Edit tariff</button>
        </div>
      ) : null}

      {bill ? (
        <div className="billing-results">
          <div className="billing-cards">
            <div className="billing-card">
              <div className="billing-card-label">Total kWh</div>
              <div className="billing-card-value">{bill.totalKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
            </div>
            <div className="billing-card">
              <div className="billing-card-label">Energy Cost</div>
              <div className="billing-card-value">{money(bill.energyCost, bill.currency)}</div>
            </div>
            <div className="billing-card">
              <div className="billing-card-label">Demand ({bill.peakDemandKw.toFixed(1)} kW)</div>
              <div className="billing-card-value">{money(bill.demandCost, bill.currency)}</div>
            </div>
            <div className="billing-card billing-card-accent">
              <div className="billing-card-label">Grand Total (incl. VAT)</div>
              <div className="billing-card-value">{money(bill.grandTotal, bill.currency)}</div>
            </div>
          </div>

          <div className="billing-grid2">
            <section className="billing-sec">
              <h4>Line Items</h4>
              <table className="data-table compact">
                <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                <tbody>
                  {bill.lineItems.map((line, i) => (
                    <tr key={i}>
                      <td>{line.label}</td>
                      <td>{line.quantity != null ? `${line.quantity} ${line.unit ?? ''}` : '—'}</td>
                      <td>{line.unitPrice != null ? line.unitPrice : '—'}</td>
                      <td>{money(line.amount, bill.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="billing-sec">
              <h4>Per-Device Bills</h4>
              <table className="data-table compact">
                <thead>
                  <tr><th>Device</th><th>Role</th><th>kWh</th><th>Share</th><th>Cost</th></tr>
                </thead>
                <tbody>
                  {bill.devices.length === 0 ? (
                    <tr><td colSpan={5}>No device breakdown — configure energy mapping on devices.</td></tr>
                  ) : bill.devices.map((d) => (
                    <tr key={d.deviceId}>
                      <td>{d.deviceName}</td>
                      <td>{d.role}</td>
                      <td>{d.kwh.toFixed(1)}</td>
                      <td>{d.sharePct.toFixed(1)}%</td>
                      <td>{money(d.subtotal, bill.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {(bill.touBreakdown.length > 0 || bill.tierBreakdown.length > 0) ? (
            <section className="billing-sec">
              <h4>{bill.touBreakdown.length ? 'TOU Breakdown' : 'Tier Breakdown'}</h4>
              <table className="data-table compact">
                <thead><tr><th>Band / Tier</th><th>kWh</th><th>Rate</th><th>Cost</th></tr></thead>
                <tbody>
                  {(bill.touBreakdown.length ? bill.touBreakdown : bill.tierBreakdown).map((row, i) => (
                    <tr key={i}>
                      <td>{row.label}</td>
                      <td>{row.kwh.toFixed(2)}</td>
                      <td>{row.ratePerKwh}</td>
                      <td>{money(row.cost, bill.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {bill.warnings.length ? (
            <div className="billing-msg">{bill.warnings.join(' · ')}</div>
          ) : null}

          <p className="billing-meta">
            Tariff: {bill.tariffName} ({bill.tariffMode}) · Data: {bill.dataSource} · Strategy: {bill.strategy}
            {bill.from ? ` · ${new Date(bill.from).toLocaleDateString()} – ${bill.to ? new Date(bill.to).toLocaleDateString() : ''}` : ''}
          </p>
        </div>
      ) : (
        <div className="billing-empty">
          <Icon icon="solar:calculator-minimalistic-bold-duotone" width={48} color="#64748b" />
          <p>เลือก Tariff และช่วงเวลา แล้วกด Simulate Bill เพื่อดูบิลรวมและรายอุปกรณ์</p>
        </div>
      )}

      <section className="billing-sec billing-tariff-list">
        <div className="billing-sec-head-row">
          <h4>Available Tariffs</h4>
          <button type="button" className="btn secondary btn-sm" onClick={openCreate}>+ New</button>
        </div>
        <div className="billing-tariff-grid">
          {tariffs.map((t) => (
            <div
              key={t.id}
              className={`billing-tariff-card${t.id === selectedTariffId ? ' active' : ''}`}
              onClick={() => setSelectedTariffId(t.id)}
              style={{ position: 'relative', cursor: 'pointer', padding: '16px', borderRadius: '8px', border: t.id === selectedTariffId ? '2px solid #087c8b' : '1px solid #c9dbe2', background: t.id === selectedTariffId ? '#f0fcfe' : '#fff', transition: 'all 0.2s' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, paddingRight: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: 14, color: '#142033' }}>{t.name}{t.isDefault ? ' ★' : ''}</strong>
                    <span className="billing-pill-sm" style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{(t.config.mode as TariffMode)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#5b6b7b', lineHeight: 1.4 }}>{t.description ?? '—'}</p>
                </div>
                <div className="billing-tariff-card-actions" style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
                  <button type="button" className="btn-link" onClick={(e) => { e.stopPropagation(); openEdit(t); }} style={{ padding: 4, color: '#087c8b', opacity: 0.7 }} title="Edit"><Icon icon="solar:pen-bold-duotone" width="16" height="16" /></button>
                  <button type="button" className="btn-link danger" onClick={(e) => { e.stopPropagation(); void handleDelete(t); }} style={{ padding: 4, color: '#ef4444', opacity: 0.7 }} title="Delete"><Icon icon="solar:trash-bin-trash-bold-duotone" width="16" height="16" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <TariffEditorModal
        open={editorOpen}
        projectId={projectId}
        tariff={editingTariff}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void refreshTariffs()}
      />
    </div>
  );
}

export default BillingPanel;
