import type { DeviceEnergyMapping, DeviceEnergyRole } from '@energylink/shared-types';
import {
  CRITICAL_LEVEL_OPTIONS,
  defaultIncludeInCarbon,
  ENERGY_ROLE_OPTIONS,
  ENERGY_SOURCE_OPTIONS,
  LOAD_CATEGORY_OPTIONS,
  TOPOLOGY_NODE_OPTIONS,
} from '@energylink/shared-types';

type DeviceEnergyMappingCardProps = {
  mapping: DeviceEnergyMapping;
  onChange: (next: DeviceEnergyMapping) => void;
  deviceType?: string;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
};

function patchRole(mapping: DeviceEnergyMapping, role: DeviceEnergyRole): DeviceEnergyMapping {
  return {
    ...mapping,
    role,
    includeInCarbon: defaultIncludeInCarbon(role),
    source: role === 'generation' ? mapping.source || 'grid' : mapping.source,
  };
}

export function DeviceEnergyMappingCard({
  mapping,
  onChange,
  showAdvanced = false,
  onToggleAdvanced,
}: DeviceEnergyMappingCardProps) {
  return (
    <div className="dv-energy-card">
      <div className="dv-energy-card-head">
        <div className="dv-energy-card-title">Energy & carbon</div>
        <label className="dv-energy-check">
          <input
            type="checkbox"
            checked={mapping.viewerVisible}
            onChange={e => onChange({ ...mapping, viewerVisible: e.target.checked })}
          />
          Web Viewer
        </label>
      </div>

      <div className="dv-form-row dv-energy-grid-main">
        <div className="dv-form-group dv-energy-span-2">
          <label>Role</label>
          <select
            value={mapping.role}
            onChange={e => onChange(patchRole(mapping, e.target.value as DeviceEnergyRole))}
          >
            {ENERGY_ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {mapping.role === 'generation' && (
          <div className="dv-form-group">
            <label>Source</label>
            <select
              value={mapping.source}
              onChange={e => onChange({ ...mapping, source: e.target.value as DeviceEnergyMapping['source'] })}
            >
              {ENERGY_SOURCE_OPTIONS.filter(o => o.value !== '').map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="dv-form-group">
          <label>Load category</label>
          <select
            value={mapping.loadCategory}
            onChange={e => onChange({ ...mapping, loadCategory: e.target.value })}
          >
            {LOAD_CATEGORY_OPTIONS.map(o => (
              <option key={o.value || 'none'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="dv-energy-check dv-energy-carbon">
        <input
          type="checkbox"
          checked={mapping.includeInCarbon}
          onChange={e => onChange({ ...mapping, includeInCarbon: e.target.checked })}
        />
        <span>Include in carbon totals</span>
      </label>

      {onToggleAdvanced && (
        <button type="button" className="dv-energy-advanced-toggle" onClick={onToggleAdvanced}>
          {showAdvanced ? 'Hide advanced' : 'Advanced'}
        </button>
      )}

      {showAdvanced && (
        <div className="dv-form-row dv-energy-grid-advanced">
          <div className="dv-form-group">
            <label>Topology node</label>
            <select
              value={mapping.advanced?.topologyNode ?? ''}
              onChange={e =>
                onChange({
                  ...mapping,
                  advanced: { ...mapping.advanced, topologyNode: e.target.value || undefined },
                })
              }
            >
              {TOPOLOGY_NODE_OPTIONS.map(o => (
                <option key={o.value || 'none'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="dv-form-group">
            <label>Parent panel</label>
            <input
              value={mapping.advanced?.parentNode ?? ''}
              onChange={e =>
                onChange({
                  ...mapping,
                  advanced: { ...mapping.advanced, parentNode: e.target.value || undefined },
                })
              }
              placeholder="MDB-01"
            />
          </div>
          <div className="dv-form-group">
            <label>Critical level</label>
            <select
              value={mapping.advanced?.criticalLevel ?? 'normal'}
              onChange={e =>
                onChange({
                  ...mapping,
                  advanced: { ...mapping.advanced, criticalLevel: e.target.value },
                })
              }
            >
              {CRITICAL_LEVEL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeviceEnergyMappingSummary({ mapping }: { mapping: DeviceEnergyMapping }) {
  const role = ENERGY_ROLE_OPTIONS.find(o => o.value === mapping.role)?.label ?? mapping.role;
  const load = LOAD_CATEGORY_OPTIONS.find(o => o.value === mapping.loadCategory)?.label;
  return (
    <>
      <div className="dv-prop-item">
        <span className="dv-prop-label">Energy role</span>
        <span className="dv-prop-value">{role}</span>
      </div>
      {mapping.role === 'generation' && mapping.source && (
        <div className="dv-prop-item">
          <span className="dv-prop-label">Source</span>
          <span className="dv-prop-value">
            {ENERGY_SOURCE_OPTIONS.find(o => o.value === mapping.source)?.label ?? mapping.source}
          </span>
        </div>
      )}
      {load && load !== 'Not specified' && (
        <div className="dv-prop-item">
          <span className="dv-prop-label">Load category</span>
          <span className="dv-prop-value">{load}</span>
        </div>
      )}
      <div className="dv-prop-item">
        <span className="dv-prop-label">Carbon</span>
        <span className="dv-prop-value">
          {mapping.includeInCarbon ? 'Included' : 'Excluded'}
        </span>
      </div>
    </>
  );
}
