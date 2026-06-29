import { useEffect, useMemo, useRef, useState } from 'react';
import { useModal } from '../../context/ModalContext';
import type { CreateProjectInput, ProjectDatabaseStatus, ProjectSummary } from '@energylink/shared-types';
import { FACILITY_TYPE_OPTIONS, DEFAULT_EMISSION_FACTOR_KG_PER_KWH } from '@energylink/shared-types';
import { EDITOR_COMMAND_EVENT, normalizeCommand, type EditorCommand } from '../../commandBus';
import { Icon } from '@iconify/react';
import { getEngineUrl } from '@energylink/shared-ui';
import { PublishDialog } from './PublishDialog';

/* ─── helpers ─────────────────────────────────────────────────── */
const blankForm = (): CreateProjectInput => ({
  name: '', customerName: '', location: '',
  timezone: 'Asia/Bangkok', currency: 'THB', energyCostRate: 0,
  facilityType: 'mixed',
  emissionFactorKgPerKwh: DEFAULT_EMISSION_FACTOR_KG_PER_KWH,
  netMetering: false,
  floorAreaM2: null,
});

function downloadText(filename: string, text: string) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([text], { type: 'application/json' })),
    download: filename
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function readJsonFile<T>(): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const r = new FileReader();
      r.onload  = () => { try { resolve(JSON.parse(r.result as string)); } catch (e) { reject(e); } };
      r.onerror = () => reject(r.error);
      r.readAsText(file, 'utf-8');
    };
    input.click();
  });
}

const TIMEZONES = [
  'Asia/Bangkok','Asia/Singapore','Asia/Tokyo','Asia/Kuala_Lumpur',
  'Asia/Jakarta','Asia/Hong_Kong','Asia/Kolkata','Asia/Dubai',
  'Europe/London','Europe/Paris','Europe/Berlin',
  'America/New_York','America/Chicago','America/Los_Angeles','UTC'
];
const CURRENCIES = ['THB','USD','EUR','SGD','JPY','GBP','CNY','AUD','INR','MYR','IDR'];

/* ─── types ───────────────────────────────────────────────────── */
type Panel = 'none' | 'new' | 'edit';
type Toast = { id: number; type: 'ok' | 'err'; msg: string };
type ProjectManagerCache = {
  projects: ProjectSummary[];
  status: ProjectDatabaseStatus | null;
  activeId?: string;
  updatedAt: number;
};

const PROJECT_MANAGER_CACHE_TTL_MS = 60_000;
let projectManagerCache: ProjectManagerCache | null = null;

/* ═══════════════════════════════════════════════════════════════ */
export function FileWorkspace() {
  const { showConfirm } = useModal();

  const [projects, setProjects]   = useState<ProjectSummary[]>(() => projectManagerCache?.projects ?? []);
  const [status,   setStatus]     = useState<ProjectDatabaseStatus | null>(() => projectManagerCache?.status ?? null);
  const [activeId, setActiveId]   = useState<string | undefined>(() => projectManagerCache?.activeId);
  const [panel,    setPanel]      = useState<Panel>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing,  setEditing]    = useState<ProjectSummary | null>(null);
  const [form,     setForm]       = useState<CreateProjectInput>(blankForm());
  const [saving,   setSaving]     = useState(false);
  const [toasts,      setToasts]      = useState<Toast[]>([]);
  const [showPublish, setShowPublish] = useState(false);
  const toastId = useRef(0);

  /* ── toast ── */
  function toast(type: 'ok' | 'err', msg: string) {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }

  /* ── data ── */
  async function refresh(keepActive = true, activeOverride?: string) {
    try {
      const [list, db] = await Promise.all([
        window.energylink.projects.list(),
        window.energylink.projects.status()
      ]);
      const nextActiveId = keepActive ? (db.activeProjectId ?? list[0]?.id) : (activeOverride ?? activeId);
      setProjects(list);
      setStatus(db);
      if (keepActive) setActiveId(nextActiveId);
      projectManagerCache = { projects: list, status: db, activeId: nextActiveId, updatedAt: Date.now() };
      return { list, db };
    } catch (e) { toast('err', e instanceof Error ? e.message : String(e)); return null; }
  }

  useEffect(() => {
    if (projectManagerCache && Date.now() - projectManagerCache.updatedAt < PROJECT_MANAGER_CACHE_TTL_MS) {
      return;
    }
    void refresh();
  }, []);

  const activeProject = useMemo(() => projects.find(p => p.id === activeId), [projects, activeId]);

  /* ── open (set active) ── */
  async function handleOpen(id: string) {
    try {
      const p = await window.energylink.projects.setActive(id);
      setActiveId(p.id);
      if (projectManagerCache) projectManagerCache = { ...projectManagerCache, activeId: p.id };
      toast('ok', `Opened "${p.name}" — navigating to Devices…`);
      await refresh(false, p.id);
      window.dispatchEvent(new CustomEvent('energylink:active-project-changed', { detail: p.id }));
      // Navigate to Devices so the user can configure hardware for the opened project
      window.dispatchEvent(new CustomEvent('energylink:switch-module', { detail: 'devices' }));
    } catch (e) { toast('err', e instanceof Error ? e.message : String(e)); }
  }

  /* ── create ── */
  async function handleCreate() {
    if (!form.name.trim()) { toast('err', 'Project Name is required.'); return; }
    setSaving(true);
    try {
      const p = await window.energylink.projects.create(form);
      setActiveId(p.id);
      if (projectManagerCache) projectManagerCache = { ...projectManagerCache, activeId: p.id };
      toast('ok', `Project "${p.name}" created.`);
      setPanel('none');
      await refresh(false, p.id);
      window.dispatchEvent(new CustomEvent('energylink:active-project-changed', { detail: p.id }));
      // Navigate to Devices so the user can configure hardware for the new project
      window.dispatchEvent(new CustomEvent('energylink:switch-module', { detail: 'devices' }));
    } catch (e) { toast('err', e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  /* ── save edit ── */
  async function handleSave() {
    if (!editing) return;
    if (!form.name.trim()) { toast('err', 'Project Name is required.'); return; }
    setSaving(true);
    try {
      const p = await window.energylink.projects.update({
        id: editing.id, name: form.name,
        customerName: form.customerName || null,
        location:     form.location     || null,
        timezone:     form.timezone,
        currency:     form.currency,
        energyCostRate: Number(form.energyCostRate ?? 0),
        facilityType: form.facilityType || 'mixed',
        emissionFactorKgPerKwh: Number(form.emissionFactorKgPerKwh ?? DEFAULT_EMISSION_FACTOR_KG_PER_KWH),
        netMetering: Boolean(form.netMetering),
        floorAreaM2: form.floorAreaM2 === '' || form.floorAreaM2 == null ? null : Number(form.floorAreaM2),
        status: editing.status
      });
      toast('ok', `Project "${p.name}" saved.`);
      setPanel('none');
      await refresh();
    } catch (e) { toast('err', e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  /* ── delete ── */
  async function handleDelete(p: ProjectSummary) {
    const ok = await showConfirm(
      `Delete "${p.name}"?\n\nThis permanently removes all associated Devices, Tags, Graphics and Reports.`
    );
    if (!ok) return;
    try {
      await window.energylink.projects.delete(p.id);
      toast('ok', `"${p.name}" deleted.`);
      if (editing?.id === p.id) setPanel('none');
      await refresh();
      window.dispatchEvent(new CustomEvent('energylink:active-project-changed'));
    } catch (e) { toast('err', e instanceof Error ? e.message : String(e)); }
  }

  /* ── publish (Export to Monitor) ── */
  function handlePublish() {
    if (!activeProject) { toast('err', 'Open a project first before exporting to Monitor.'); return; }
    setShowPublish(true);
  }

  async function handleBackfillCarbonTags() {
    if (!activeProject) { toast('err', 'Open a project first.'); return; }
    try {
      const res = await fetch(`${getEngineUrl()}/api/carbon/backfill-tag-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'Backfill failed');
      toast('ok', `Carbon tag roles updated: ${data.updated ?? 0} of ${data.scanned ?? 0} tags.`);
    } catch (e) {
      toast('err', e instanceof Error ? e.message : String(e));
    }
  }

  /* ── import / export ── */
  async function handleExport() {
    try {
      const payload = { exportedAt: new Date().toISOString(), projects, status };
      downloadText(`energylink-projects-${Date.now()}.json`, JSON.stringify(payload, null, 2));
      toast('ok', 'Projects exported successfully.');
    } catch (e) { toast('err', e instanceof Error ? e.message : String(e)); }
  }
  async function handleImport() {
    try {
      const raw = await readJsonFile<{ projects?: CreateProjectInput[]; name?: string }>();
      if (!raw) return;
      const items = Array.isArray(raw.projects) ? raw.projects : raw.name ? [raw as CreateProjectInput] : [];
      if (!items.length) throw new Error('No valid project data found in file.');
      for (const item of items) await window.energylink.projects.create({ ...blankForm(), ...item });
      toast('ok', `Imported ${items.length} project(s).`);
      await refresh();
    } catch (e) { toast('err', e instanceof Error ? e.message : String(e)); }
  }

  /* ── panel helpers ── */
  function openNew()  { setForm(blankForm()); setEditing(null); setPanel('new'); }
  function openEdit(p: ProjectSummary) {
    setForm({ name: p.name, customerName: p.customerName ?? '', location: p.location ?? '',
              timezone: p.timezone, currency: p.currency, energyCostRate: p.energyCostRate,
              facilityType: p.facilityType ?? 'mixed',
              emissionFactorKgPerKwh: p.emissionFactorKgPerKwh ?? DEFAULT_EMISSION_FACTOR_KG_PER_KWH,
              netMetering: Boolean(p.netMetering),
              floorAreaM2: p.floorAreaM2 ?? null });
    setEditing(p);
    setPanel('edit');
  }
  function closePanel() { setPanel('none'); setEditing(null); }

  /* ── ribbon commands ── */
  useEffect(() => {
    async function handler(e: Event) {
      const { module, item } = (e as CustomEvent<EditorCommand>).detail;
      if (module !== 'file') return;
      const cmd = normalizeCommand(item);
      if (cmd === 'new')                                    openNew();
      else if (cmd === 'open') {
        if (panel !== 'none') {
          closePanel();
        } else if (selectedId) {
          void handleOpen(selectedId);
        } else if (activeId) {
          // If no row is selected, but there is an active project, open it (navigate to Devices)
          void handleOpen(activeId);
        } else {
          toast('err', 'Please select a project to open.');
        }
      }
      else if (['project manager','project list'].includes(cmd)) closePanel();
      else if (cmd === 'save')  { if (panel === 'new') void handleCreate(); else if (panel === 'edit') void handleSave(); }
      else if (cmd === 'import') void handleImport();
      else if (cmd === 'export') void handleExport();
      else if (['publish','export to monitor','sync to monitor'].includes(cmd)) handlePublish();
      else if (cmd === 'exit')  { if (await showConfirm('Close EnergyLink Editor?')) window.close(); }
    }
    window.addEventListener(EDITOR_COMMAND_EVENT, handler);
    return () => window.removeEventListener(EDITOR_COMMAND_EVENT, handler);
  }, [panel, form, editing, projects, status, selectedId]);

  /* ─────────────────────────── RENDER ──────────────────────────── */
  return (
    <div className="pm-root">

      {/* ─ Toasts ─────────────────────────────── */}
      <div className="pm-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`pm-toast pm-toast--${t.type}`}>
            <span className="pm-toast-icon">{t.type === 'ok' ? '✓' : '!'}</span>
            {t.msg}
          </div>
        ))}
      </div>

      {/* ─ Header ─────────────────────────────── */}
      <header className="pm-header">
        <div className="pm-header-brand">
          <span className="pm-header-logo">⚡</span>
          <div>
            <div className="pm-header-title">Project Manager</div>
          </div>
        </div>
        <div className="pm-header-meta">
          <div className={`pm-db-indicator ${status?.connected ? 'pm-db-on' : 'pm-db-off'}`}>
            <span className="pm-db-dot" />
            {status?.connected ? 'Database Connected' : 'Not Connected'}
          </div>
          {activeProject && (
            <div className="pm-active-chip">
              <span className="pm-active-chip-label">Active</span>
              {activeProject.name}
            </div>
          )}
        </div>
        <div className="pm-header-actions">
          <button className="pm-btn pm-btn--ghost" onClick={() => void refresh()} title="Refresh list">
            <Icon icon="solar:refresh-bold-duotone" width="16" height="16" style={{ color: '#3b82f6' }} />
            Refresh
          </button>
          <button className="pm-btn pm-btn--ghost" onClick={() => void handleImport()} title="Import JSON">
            <Icon icon="solar:download-bold-duotone" width="16" height="16" style={{ color: '#10b981' }} />
            Import
          </button>
          <button className="pm-btn pm-btn--ghost" onClick={() => void handleExport()} title="Export JSON backup" disabled={!projects.length}>
            <Icon icon="solar:upload-bold-duotone" width="16" height="16" style={{ color: '#f59e0b' }} />
            Export
          </button>
          <button
            className="pm-btn pm-btn--ghost"
            onClick={() => void handleBackfillCarbonTags()}
            title="Auto-map energy tag roles from names/units"
            disabled={!activeProject}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon icon="solar:leaf-bold-duotone" width="16" height="16" style={{ color: '#10b981' }} />
            Backfill Carbon Tags
          </button>
          <button
            className="pm-btn pm-btn--primary"
            onClick={handlePublish}
            title="Export current project to Monitor"
            disabled={!activeProject}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon icon="solar:planet-bold-duotone" width="16" height="16" />
            Export to Monitor
          </button>
          <button className="pm-btn pm-btn--primary" onClick={openNew}>
            <Icon icon="solar:document-add-bold-duotone" width="16" height="16" style={{ color: '#34d399' }} />
            New Project
          </button>
        </div>
      </header>

      {/* ─ Body (table + slide panel) ───────────── */}
      <div className="pm-body">

        {/* ── Project Table ── */}
        <div className={`pm-table-wrap ${panel !== 'none' ? 'pm-table-wrap--narrow' : ''}`}>
          {/* Summary bar */}
          <div className="pm-summary-bar">
            <div className="pm-summary-stat">
              <b>{projects.length}</b><span>Projects</span>
            </div>
            <div className="pm-summary-stat">
              <b>{activeProject?.name ?? '—'}</b><span>Active</span>
            </div>
            <div className="pm-summary-stat">
              <b>{status?.projectCount ?? 0}</b><span>Total in DB</span>
            </div>
          </div>

          {/* Table */}
          {projects.length === 0 ? (
            <div className="pm-empty">
              <div className="pm-empty-icon">📁</div>
              <div className="pm-empty-title">No projects yet</div>
              <button className="pm-btn pm-btn--primary" onClick={openNew}>
                <Icon icon="solar:document-add-bold-duotone" width="16" height="16" style={{ color: '#34d399' }} />
                Create First Project
              </button>
            </div>
          ) : (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Timezone</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const isActive = p.id === activeId;
                  const isSelected = p.id === selectedId;
                  return (
                    <tr
                      key={p.id}
                      className={`${isActive ? 'pm-row--active' : ''} ${isSelected ? 'pm-row--selected' : ''}`}
                      onClick={() => setSelectedId(p.id)}
                      onDoubleClick={() => void handleOpen(p.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="pm-project-name-cell">
                          {isActive && <span className="pm-active-badge" title="Currently active">●</span>}
                          <span className="pm-project-name">{p.name}</span>
                        </div>
                      </td>
                      <td className="pm-cell-muted">{p.customerName || '—'}</td>
                      <td className="pm-cell-muted">{p.location || '—'}</td>
                      <td className="pm-cell-muted pm-cell-mono">{p.timezone}</td>
                      <td>
                        <span className={`pm-status-badge pm-status--${p.status}`}>{p.status}</span>
                      </td>
                      <td className="pm-cell-muted pm-cell-date">
                        {new Date(p.updatedAt).toLocaleString()}
                      </td>
                      <td>
                        <div className="pm-row-actions">
                          {/* OPEN — set this as the active project */}
                          {!isActive && (
                            <button
                              className="pm-action-btn pm-action-btn--open"
                              onClick={() => void handleOpen(p.id)}
                              title="Set as active project"
                              style={{ display: 'inline-flex', alignItems: 'center' }}
                            >
                              <Icon icon="solar:play-bold-duotone" width="13" height="13" style={{ marginRight: 3, verticalAlign: 'middle' }} />
                              Open
                            </button>
                          )}
                          {isActive && (
                            <span className="pm-action-btn pm-action-btn--current" title="Currently active" style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <Icon icon="solar:check-circle-bold-duotone" width="13" height="13" style={{ marginRight: 3, color: '#166534', verticalAlign: 'middle' }} />
                              Active
                            </span>
                          )}
                          <button
                            className="pm-action-btn pm-action-btn--edit"
                            onClick={() => openEdit(p)}
                            title="Edit project settings"
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                          >
                            <Icon icon="solar:pen-bold-duotone" width="13" height="13" style={{ marginRight: 3, color: '#0ea5e9', verticalAlign: 'middle' }} />
                            Edit
                          </button>
                          <button
                            className="pm-action-btn pm-action-btn--delete"
                            onClick={() => void handleDelete(p)}
                            title="Delete project"
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                          >
                            <Icon icon="solar:trash-bin-trash-bold-duotone" width="13" height="13" style={{ marginRight: 3, color: '#ef4444', verticalAlign: 'middle' }} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* DB path */}
          {status?.databasePath && (
            <div className="pm-db-path">
              <span className="pm-db-path-label">Database</span>
              <span className="pm-db-path-value">{status.databasePath}</span>
            </div>
          )}
        </div>

        {/* ── Slide-in Form Panel ── */}
        {panel !== 'none' && (
          <aside className="pm-panel">
            <div className="pm-panel-header">
              <div>
                <div className="pm-panel-title">
                  {panel === 'new' ? 'New Project' : 'Edit Project'}
                </div>
              </div>
              <button className="pm-panel-close" onClick={closePanel} title="Close">✕</button>
            </div>

            <div className="pm-panel-body">
              {/* Project Info */}
              <div className="pm-section-label">Project Information</div>

              <div className="pm-field">
                <label htmlFor="f-name">Project Name <span className="pm-required">*</span></label>
                <input
                  id="f-name"
                  className="pm-input"
                  placeholder="e.g. Factory A Energy Monitor"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="pm-field-row">
                <div className="pm-field">
                  <label htmlFor="f-customer">Customer Name</label>
                  <input
                    id="f-customer"
                    className="pm-input"
                    placeholder="e.g. ABC Co., Ltd."
                    value={form.customerName ?? ''}
                    onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  />
                </div>
                <div className="pm-field">
                  <label htmlFor="f-location">Location</label>
                  <input
                    id="f-location"
                    className="pm-input"
                    placeholder="e.g. Bangkok, Thailand"
                    value={form.location ?? ''}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="pm-section-label" style={{ marginTop: 20 }}>System Settings</div>

              <div className="pm-field">
                <label htmlFor="f-tz">Timezone</label>
                <select
                  id="f-tz"
                  className="pm-input pm-select"
                  value={form.timezone}
                  onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>

              <div className="pm-section-label" style={{ marginTop: 20 }}>Carbon & Energy</div>

              <div className="pm-field">
                <label htmlFor="f-facility">Facility type</label>
                <select
                  id="f-facility"
                  className="pm-input pm-select"
                  value={form.facilityType ?? 'mixed'}
                  onChange={e => setForm(f => ({ ...f, facilityType: e.target.value }))}
                >
                  {FACILITY_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="pm-field-row">
                <div className="pm-field">
                  <label htmlFor="f-factor">Emission factor (kg CO₂/kWh)</label>
                  <input
                    id="f-factor"
                    className="pm-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.emissionFactorKgPerKwh ?? DEFAULT_EMISSION_FACTOR_KG_PER_KWH}
                    onChange={e => setForm(f => ({ ...f, emissionFactorKgPerKwh: Number(e.target.value) }))}
                  />
                </div>
                <div className="pm-field">
                  <label htmlFor="f-area">Floor area (m²)</label>
                  <input
                    id="f-area"
                    className="pm-input"
                    type="number"
                    min={0}
                    placeholder="Optional"
                    value={form.floorAreaM2 ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      floorAreaM2: e.target.value === '' ? null : Number(e.target.value),
                    }))}
                  />
                </div>
              </div>

              <label className="pm-checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.netMetering)}
                  onChange={e => setForm(f => ({ ...f, netMetering: e.target.checked }))}
                />
                <span>Net metering</span>
              </label>

              {/* Edit-only: project meta */}
              {panel === 'edit' && editing && (
                <div className="pm-meta-box">
                  <div className="pm-meta-row"><span>Status</span>
                    <span className={`pm-status-badge pm-status--${editing.status}`}>{editing.status}</span>
                  </div>
                  <div className="pm-meta-row"><span>Created</span>
                    <span>{new Date(editing.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="pm-meta-row"><span>Last updated</span>
                    <span>{new Date(editing.updatedAt).toLocaleString()}</span>
                  </div>
                  {editing.id !== activeId && (
                    <div className="pm-meta-row"><span>Active?</span>
                      <button
                        className="pm-inline-open-btn"
                        onClick={() => void handleOpen(editing.id)}
                      >
                        Set as Active Project
                      </button>
                    </div>
                  )}
                  {editing.id === activeId && (
                    <div className="pm-meta-row"><span>Active?</span>
                      <span className="pm-active-badge-text">✓ Currently Active</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="pm-panel-footer">
              {panel === 'edit' && editing && (
                <button
                  className="pm-btn pm-btn--danger-ghost"
                  onClick={() => void handleDelete(editing)}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <Icon icon="solar:trash-bin-trash-bold-duotone" width="15" height="15" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Delete Project
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="pm-btn pm-btn--secondary" onClick={closePanel}>Cancel</button>
              <button
                className="pm-btn pm-btn--primary"
                disabled={saving || !form.name.trim()}
                onClick={panel === 'new' ? handleCreate : handleSave}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <Icon icon={panel === 'new' ? 'solar:document-add-bold-duotone' : 'solar:diskette-bold-duotone'} width="15" height="15" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {saving
                  ? 'Saving…'
                  : panel === 'new' ? 'Create Project' : 'Save Changes'}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Export to Monitor dialog */}
      {showPublish && activeProject && (
        <PublishDialog
          projectId={activeProject.id}
          projectName={activeProject.name}
          onClose={() => setShowPublish(false)}
          onPublished={(r) => {
            void refresh();
            toast('ok', `"${activeProject.name}" exported to Monitor (v${r.snapshot?.version ?? '?'}).`);
          }}
        />
      )}
    </div>
  );
}
