import React from 'react';
import { Icon } from '@iconify/react';
import {
  DEFAULT_THAILAND_TOU_BANDS,
  DEFAULT_TIERED_TARIFF,
  normalizeTariffConfig,
  type EnergyTariffConfig,
  type TariffMode,
  type TariffTier,
  type TariffTouBand,
} from '@energylink/shared-types';
import { billingApi, type TariffModeInfo, type TariffSummary } from '../../api/billingApi';

export type TariffEditorModalProps = {
  open: boolean;
  projectId?: string | null;
  tariff: TariffSummary | null;
  onClose: () => void;
  onSaved: () => void;
};

function defaultConfigForMode(mode: TariffMode): EnergyTariffConfig {
  return normalizeTariffConfig({ mode, flatRatePerKwh: 4 });
}

function numInput(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function TariffEditorModal({ open, projectId, tariff, onClose, onSaved }: TariffEditorModalProps) {
  const isEdit = Boolean(tariff?.id);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isDefault, setIsDefault] = React.useState(false);
  const [effectiveFrom, setEffectiveFrom] = React.useState('');
  const [config, setConfig] = React.useState<EnergyTariffConfig>(defaultConfigForMode('flat'));
  const [modes, setModes] = React.useState<TariffModeInfo[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    void billingApi.getModes().then((res) => {
      if (res.ok) setModes(res.data.modes);
    });
    if (tariff) {
      setName(tariff.name);
      setDescription(tariff.description ?? '');
      setIsDefault(tariff.isDefault);
      setEffectiveFrom(tariff.effectiveFrom ? tariff.effectiveFrom.slice(0, 10) : '');
      setConfig(normalizeTariffConfig(tariff.config));
    } else {
      setName('');
      setDescription('');
      setIsDefault(false);
      setEffectiveFrom('');
      setConfig(defaultConfigForMode('flat'));
    }
    setError(null);
  }, [open, tariff]);

  const setMode = (mode: TariffMode) => {
    setConfig((prev) => normalizeTariffConfig({ ...prev, mode }));
  };

  const patchConfig = (patch: Partial<EnergyTariffConfig>) => {
    setConfig((prev) => normalizeTariffConfig({ ...prev, ...patch }));
  };

  const updateTier = (index: number, patch: Partial<TariffTier>) => {
    const tiers = [...(config.tiers ?? DEFAULT_TIERED_TARIFF)];
    tiers[index] = { ...tiers[index], ...patch };
    patchConfig({ tiers });
  };

  const addTier = () => {
    const tiers = [...(config.tiers ?? DEFAULT_TIERED_TARIFF)];
    const last = tiers[tiers.length - 1];
    tiers.push({
      fromKwh: last?.toKwh ?? (last?.fromKwh ?? 0) + 100,
      toKwh: undefined,
      ratePerKwh: last?.ratePerKwh ?? 4,
      label: `Block ${tiers.length + 1}`,
    });
    patchConfig({ tiers });
  };

  const removeTier = (index: number) => {
    const tiers = (config.tiers ?? []).filter((_, i) => i !== index);
    patchConfig({ tiers: tiers.length ? tiers : DEFAULT_TIERED_TARIFF });
  };

  const updateBand = (index: number, patch: Partial<TariffTouBand>) => {
    const bands = [...(config.touBands ?? DEFAULT_THAILAND_TOU_BANDS)];
    bands[index] = { ...bands[index], ...patch };
    patchConfig({ touBands: bands });
  };

  const addBand = () => {
    const bands = [...(config.touBands ?? DEFAULT_THAILAND_TOU_BANDS)];
    bands.push({
      id: `band_${bands.length + 1}`,
      label: `Band ${bands.length + 1}`,
      ratePerKwh: 4,
      startHour: 0,
      endHour: 24,
    });
    patchConfig({ touBands: bands });
  };

  const removeBand = (index: number) => {
    const bands = (config.touBands ?? []).filter((_, i) => i !== index);
    patchConfig({ touBands: bands.length ? bands : DEFAULT_THAILAND_TOU_BANDS });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('กรุณาระบุชื่อ Tariff');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await billingApi.saveTariff({
      id: tariff?.id,
      projectId: projectId ?? undefined,
      name: trimmed,
      description: description.trim() || undefined,
      isDefault,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      config: normalizeTariffConfig(config),
    });
    setBusy(false);
    if ('message' in res) {
      setError(res.message);
      return;
    }
    onSaved();
    onClose();
  };

  if (!open) return null;

  const showTiers = config.mode === 'tiered';
  const showTou = config.mode === 'tou' || config.mode === 'combined';
  const showDemand = config.mode === 'combined';
  const showFlat = config.mode === 'flat' || config.mode === 'tiered';

  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <div className="rp-modal tariff-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rp-modal-header">
          <h3>{isEdit ? 'Edit Tariff' : 'New Tariff'}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <Icon icon="solar:close-circle-bold" width={22} />
          </button>
        </div>

        <div className="rp-modal-body tariff-editor-body">
          {error ? <div className="billing-msg billing-msg-err">{error}</div> : null}

          <div className="tariff-form-grid">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PEA Residential" />
            </label>
            <label>
              Mode
              <select value={config.mode} onChange={(e) => setMode(e.target.value as TariffMode)}>
                {(modes.length ? modes : [
                  { id: 'flat', label: 'Flat' },
                  { id: 'tiered', label: 'Tiered' },
                  { id: 'tou', label: 'TOU' },
                  { id: 'combined', label: 'Combined' },
                ]).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="tariff-full-row">
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" />
          </label>

          <div className="tariff-form-grid">
            <label>
              Currency
              <input value={config.currency ?? 'THB'} onChange={(e) => patchConfig({ currency: e.target.value })} />
            </label>
            <label>
              VAT %
              <input type="number" min={0} max={30} step={0.1} value={config.vatPercent ?? 7} onChange={(e) => patchConfig({ vatPercent: numInput(e.target.value, 7) })} />
            </label>
            <label>
              Fixed charge
              <input type="number" min={0} step={0.01} value={config.fixedCharge ?? 0} onChange={(e) => patchConfig({ fixedCharge: numInput(e.target.value) })} />
            </label>
            <label>
              Service charge
              <input type="number" min={0} step={0.01} value={config.serviceCharge ?? 0} onChange={(e) => patchConfig({ serviceCharge: numInput(e.target.value) })} />
            </label>
            <label>
              Effective from
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </label>
            <label className="check-row tariff-check">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Default tariff for project
            </label>
          </div>

          {showFlat && config.mode === 'flat' ? (
            <label className="tariff-full-row">
              Flat rate (THB/kWh)
              <input type="number" min={0} step={0.0001} value={config.flatRatePerKwh ?? 0} onChange={(e) => patchConfig({ flatRatePerKwh: numInput(e.target.value) })} />
            </label>
          ) : null}

          {showTiers ? (
            <section className="tariff-subsec">
              <div className="tariff-subsec-head">
                <h4>Block / Tier rates</h4>
                <button type="button" className="btn secondary btn-sm" onClick={addTier}>+ Add tier</button>
              </div>
              <table className="data-table compact">
                <thead>
                  <tr><th>Label</th><th>From kWh</th><th>To kWh</th><th>Rate</th><th></th></tr>
                </thead>
                <tbody>
                  {(config.tiers ?? []).map((tier, i) => (
                    <tr key={i}>
                      <td><input className="tariff-cell-input" value={tier.label ?? ''} onChange={(e) => updateTier(i, { label: e.target.value })} /></td>
                      <td><input className="tariff-cell-input" type="number" value={tier.fromKwh} onChange={(e) => updateTier(i, { fromKwh: numInput(e.target.value) })} /></td>
                      <td><input className="tariff-cell-input" type="number" placeholder="∞" value={tier.toKwh ?? ''} onChange={(e) => updateTier(i, { toKwh: e.target.value === '' ? undefined : numInput(e.target.value) })} /></td>
                      <td><input className="tariff-cell-input" type="number" step={0.0001} value={tier.ratePerKwh} onChange={(e) => updateTier(i, { ratePerKwh: numInput(e.target.value) })} /></td>
                      <td><button type="button" className="btn-link danger" onClick={() => removeTier(i)}>ลบ</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {showTou ? (
            <section className="tariff-subsec">
              <div className="tariff-subsec-head">
                <h4>TOU bands</h4>
                <button type="button" className="btn secondary btn-sm" onClick={addBand}>+ Add band</button>
              </div>
              <table className="data-table compact">
                <thead>
                  <tr><th>Label</th><th>Start h</th><th>End h</th><th>Rate</th><th></th></tr>
                </thead>
                <tbody>
                  {(config.touBands ?? []).map((band, i) => (
                    <tr key={band.id ?? i}>
                      <td><input className="tariff-cell-input" value={band.label} onChange={(e) => updateBand(i, { label: e.target.value })} /></td>
                      <td><input className="tariff-cell-input" type="number" min={0} max={24} value={band.startHour} onChange={(e) => updateBand(i, { startHour: numInput(e.target.value) })} /></td>
                      <td><input className="tariff-cell-input" type="number" min={0} max={24} value={band.endHour} onChange={(e) => updateBand(i, { endHour: numInput(e.target.value) })} /></td>
                      <td><input className="tariff-cell-input" type="number" step={0.0001} value={band.ratePerKwh} onChange={(e) => updateBand(i, { ratePerKwh: numInput(e.target.value) })} /></td>
                      <td><button type="button" className="btn-link danger" onClick={() => removeBand(i)}>ลบ</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {showDemand ? (
            <div className="tariff-form-grid">
              <label>
                Demand rate (THB/kW)
                <input type="number" min={0} step={0.01} value={config.demandCharge?.ratePerKw ?? 0} onChange={(e) => patchConfig({ demandCharge: { ratePerKw: numInput(e.target.value), label: config.demandCharge?.label ?? 'Demand' } })} />
              </label>
              <label>
                Demand label
                <input value={config.demandCharge?.label ?? 'Demand charge'} onChange={(e) => patchConfig({ demandCharge: { ratePerKw: config.demandCharge?.ratePerKw ?? 0, label: e.target.value } })} />
              </label>
            </div>
          ) : null}
        </div>

        <div className="rp-modal-footer">
          <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn primary" onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save Tariff' : 'Create Tariff'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TariffEditorModal;
