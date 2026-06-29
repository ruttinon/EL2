import React from 'react';
import type { DeviceSummary, ReportObjectDefinition, TagSummary } from '@energylink/shared-types';
import { hexForColorInput } from '../graphics/colorInput';
import { ChromeAppearance } from '../graphics/editor/inspector/shared/ChromeAppearance';
import { mergeStyle, styleNum, styleStr } from '../graphics/editor/inspector/inspectorUtils';
import { ReportChartSettings } from './ReportChartSettings';
import { REPORT_FORMULA_INSERT_TOKENS } from './reportTools';
import { listMeterBillingTags, isBillingEnergyTag, resolveReportScopeDeviceIds } from '@energylink/shared-types';
import { isTransparentColor, pageBackgroundIsTransparent, resolveReportObjectChromeStyle } from './reportPatchUtils';
import { FIELD_METRIC_OPTIONS, REPORT_PERIOD_OPTIONS } from './reportUiLabels';

type PageBackgroundProps = {
  color: string;
  onChange: (color: string) => void;
};

export function ReportPageBackgroundSection({ color, onChange }: PageBackgroundProps) {
  const transparent = pageBackgroundIsTransparent(color);
  const solid = transparent ? '#ffffff' : color;

  return (
    <section className="ins-sec ins-canvas-sec">
      <div className="ins-sec-head">
        <h4>พื้นหลัง</h4>
      </div>
      <label className="ins-check">
        <input
          type="checkbox"
          checked={transparent}
          onChange={(e) => onChange(e.target.checked ? 'transparent' : solid)}
        />
        โปร่งใส
      </label>
      {!transparent ? (
        <label className="ins-row">
          <span>สี</span>
          <input
            type="color"
            value={hexForColorInput(solid, '#ffffff')}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      ) : null}
    </section>
  );
}

type ObjectSupplementProps = {
  object: ReportObjectDefinition;
  tags: TagSummary[];
  devices: DeviceSummary[];
  onPatch: (patch: Partial<ReportObjectDefinition>) => void;
};

type DecorationProps = {
  object: ReportObjectDefinition;
  onPatch: (patch: Partial<ReportObjectDefinition>) => void;
};

/** Unified decoration controls for every report object (fill, border, transparency). */
export function ReportDecorationSection({ object, onPatch }: DecorationProps) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onPatch({ style: mergeStyle(object, patch) });
  };

  const transparent = object.style?.transparentBg === true
    || isTransparentColor(object.style?.background ?? object.style?.fill);
  const borderWidth = styleNum(object, 'strokeWidth', styleNum(object, 'borderWidth', 0));

  return (
    <section className="ins-sec object-appearance">
      <div className="ins-sec-head"><h4>ตกแต่ง</h4></div>
      <ChromeAppearance selected={object} setStyle={setStyle} fontSize fillLabel="สีพื้นหลัง" />
      <label className="ins-check">
        <input
          type="checkbox"
          checked={borderWidth === 0}
          onChange={(e) => {
            if (e.target.checked) {
              setStyle({ strokeWidth: 0, borderWidth: 0, stroke: 'transparent', borderColor: 'transparent' });
            } else {
              setStyle({ strokeWidth: 1, borderWidth: 1, stroke: '#94a3b8', borderColor: '#94a3b8' });
            }
          }}
        />
        <span>ไม่มีกรอบ</span>
      </label>
      <label className="ins-row">
        <span>ความหนากรอบ</span>
        <input
          type="number"
          min={0}
          max={12}
          value={borderWidth}
          onChange={(e) => {
            const sw = Math.max(0, Number(e.target.value));
            setStyle({
              strokeWidth: sw,
              borderWidth: sw,
              ...(sw === 0 ? { stroke: 'transparent', borderColor: 'transparent' } : {}),
            });
          }}
        />
      </label>
      {!transparent && borderWidth > 0 ? (
        <label className="ins-row">
          <span>สีกรอบ</span>
          <input
            type="color"
            value={hexForColorInput(styleStr(object, 'borderColor', styleStr(object, 'stroke', '#94a3b8')), '#94a3b8')}
            onChange={(e) => setStyle({ stroke: e.target.value, borderColor: e.target.value })}
          />
        </label>
      ) : null}
      <label className="ins-row">
        <span>มุมโค้ง</span>
        <input
          type="number"
          min={0}
          max={48}
          value={styleNum(object, 'borderRadius', 0)}
          onChange={(e) => setStyle({ borderRadius: Number(e.target.value) })}
        />
      </label>
      <label className="ins-row">
        <span>ความโปร่งใส</span>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={styleNum(object, 'opacity', 1)}
          onChange={(e) => setStyle({ opacity: Number(e.target.value) })}
        />
      </label>
      {(object.type === 'text' || object.type === 'date' || object.type === 'page_number') ? (
        <label className="ins-row">
          <span>ข้อความ</span>
          <input
            value={object.text ?? ''}
            onChange={(e) => onPatch({ text: e.target.value })}
          />
        </label>
      ) : null}
    </section>
  );
}

function letterForIndex(index: number): string {
  return String.fromCharCode(65 + index);
}

const FORMULA_PRESETS = [
  { label: 'พลังงานใช้จริง', value: '@usage', hint: 'ใช้ tag หลัก: last - first' },
  { label: 'ค่าไฟประมาณ', value: '@usage * @rate', hint: 'หน่วยใช้ x ค่าไฟต่อหน่วย' },
  { label: 'ยอดบิลรวม', value: '@grandTotal', hint: 'ยอดรวมจาก Billing/Tariff' },
  { label: 'VAT', value: '@vat', hint: 'ภาษีจาก Billing/Tariff' },
  { label: 'คาร์บอน kgCO2e', value: '@usage * 0.4999', hint: 'แก้ factor ตามค่าคาร์บอนที่ใช้จริง' },
  { label: 'คาร์บอน tCO2e', value: '(@usage * 0.4999) / 1000', hint: 'kgCO2e แปลงเป็นตัน' },
  { label: 'Tag A - Tag B', value: 'A - B', hint: 'ใช้เมื่อเลือก tag อย่างน้อย 2 ตัว' },
];

function ReportScopeSection({ object, devices, onPatch }: Pick<ObjectSupplementProps, 'object' | 'devices' | 'onPatch'>) {
  const scopeMode = object.props?.scopeMode ?? (object.props?.deviceId || object.deviceId ? 'device' : 'project');
  const scopeDeviceId = object.props?.scopeDeviceId ?? object.props?.deviceId ?? object.deviceId ?? '';
  const converters = devices.filter((d) => d.type === 'converter');
  const meters = devices.filter((d) => d.type !== 'converter');
  const choices = scopeMode === 'converter' ? converters : meters;

  const patchScope = (mode: string, deviceId = '') => {
    onPatch({
      deviceId: deviceId || undefined,
      props: {
        ...(object.props || {}),
        scopeMode: mode,
        scopeDeviceId: deviceId || undefined,
        deviceId: deviceId || undefined,
        deviceIds: undefined,
        tagIds: undefined,
        autoInclude: true,
      },
    });
  };

  return (
    <section className="ins-sec">
      <div className="ins-sec-head"><h4>ขอบเขตคำนวณ</h4></div>
      <label className="ins-row">
        <span>ระดับ</span>
        <select
          value={scopeMode}
          onChange={(e) => patchScope(e.target.value)}
        >
          <option value="project">ทั้งโปรเจกต์</option>
          <option value="converter">ตาม Converter</option>
          <option value="device">มิเตอร์รายตัว</option>
        </select>
      </label>
      {scopeMode !== 'project' ? (
        <label className="ins-row">
          <span>{scopeMode === 'converter' ? 'Converter' : 'มิเตอร์'}</span>
          <select
            value={scopeDeviceId}
            onChange={(e) => patchScope(scopeMode, e.target.value)}
          >
            <option value="">เลือก</option>
            {choices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}

function scopedTagsForObject(object: ReportObjectDefinition, tags: TagSummary[], devices: DeviceSummary[]) {
  const scopedDeviceIds = new Set(resolveReportScopeDeviceIds(devices, object.props ?? {}));
  const scopeMode = object.props?.scopeMode ?? 'project';
  if (scopeMode === 'project' || scopedDeviceIds.size === 0) return tags;
  return tags.filter((tag) => scopedDeviceIds.has(tag.deviceId));
}

function ReportTagSeriesSection({ object, tags, devices, onPatch }: ObjectSupplementProps) {
  const tagIds: string[] = object.tagIds?.length
    ? object.tagIds
    : (object.tagId || object.sourceTagId ? [object.tagId ?? object.sourceTagId] : []);
  const availableTags = scopedTagsForObject(object, tags, devices);
  const isChart = object.type === 'trend' || object.type === 'echart' || object.type === 'graph';
  const isTable = object.type === 'tagtable' || object.type === 'table';

  const addTag = (id: string) => {
    if (!id || tagIds.includes(id)) return;
    const next = [...tagIds, id];
    onPatch({
      tagIds: next,
      tagId: next[0],
      sourceTagId: next[0],
      binding: { ...(object.binding ?? {}), tagId: next[0], tagIds: next },
    });
  };

  const removeTag = (id: string) => {
    const next = tagIds.filter((tagId) => tagId !== id);
    onPatch({
      tagIds: next,
      tagId: next[0],
      sourceTagId: next[0],
      binding: { ...(object.binding ?? {}), tagId: next[0], tagIds: next },
    });
  };

  return (
    <section className="ins-sec">
      <div className="ins-sec-head"><h4>{isChart ? 'ข้อมูลกราฟ' : isTable ? 'ข้อมูลตาราง' : 'ข้อมูล'}</h4></div>
      <label className="ins-row">
        <span>เพิ่ม Tag</span>
        <select value="" onChange={(e) => addTag(e.target.value)}>
          <option value="">เลือก</option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
          ))}
        </select>
      </label>
      <ul className="ins-tag-var-list formula-var-list">
        {tagIds.length > 0 ? tagIds.map((id, index) => {
          const tag = tags.find((candidate) => candidate.id === id);
          return (
            <li key={id}>
              <strong>{index + 1}</strong>
              <span>{tag?.name ?? id}{tag?.unit ? ` (${tag.unit})` : ''}</span>
              <button type="button" className="ins-link-btn" onClick={() => removeTag(id)}>ลบ</button>
            </li>
          );
        }) : (
          <li className="formula-var-empty">
            <strong>!</strong>
            <span>{isChart ? 'ยังไม่เลือก Tag: กราฟจะแสดง Demo data' : 'ยังไม่เลือก Tag: ตารางจะแสดงตามขอบเขตข้อมูล'}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

function ReportImageSection({ object, onPatch }: Pick<ObjectSupplementProps, 'object' | 'onPatch'>) {
  return (
    <section className="ins-sec">
      <div className="ins-sec-head"><h4>รูปภาพ</h4></div>
      <label className="ins-row ins-row-stack">
        <span>URL / Data URL</span>
        <input
          value={object.props?.imageUrl ?? ''}
          onChange={(e) => onPatch({ props: { ...(object.props || {}), imageUrl: e.target.value } })}
          placeholder="https://... หรือ data:image/..."
        />
      </label>
    </section>
  );
}

/** Inspector for Tag Field (value) objects on the report canvas. */
export function ReportFieldSection({ object, tags, devices, onPatch }: ObjectSupplementProps) {
  const deviceId = object.deviceId ?? object.binding?.deviceId ?? '';
  const scopedTags = deviceId ? tags.filter((t) => t.deviceId === deviceId) : tags;
  const tagId = object.tagId ?? object.sourceTagId ?? '';

  return (
    <section className="ins-sec">
      <div className="ins-sec-head"><h4>ค่า Tag เฉพาะจุด</h4></div>
      <label className="ins-row">
        <span>อุปกรณ์</span>
        <select
          value={deviceId}
          onChange={(e) => {
            const nextDevice = e.target.value || undefined;
            onPatch({
              deviceId: nextDevice,
              binding: { ...(object.binding ?? {}), deviceId: nextDevice },
              tagId: undefined,
              sourceTagId: undefined,
            });
          }}
        >
          <option value="">ทั้งหมด</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      <label className="ins-row">
        <span>Tag</span>
        <select
          value={tagId}
          onChange={(e) => {
            const nextTag = e.target.value || undefined;
            onPatch({ tagId: nextTag, sourceTagId: nextTag, binding: { ...(object.binding ?? {}), tagId: nextTag } });
          }}
        >
          <option value="">เลือก</option>
          {scopedTags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.unit ? ` (${t.unit})` : ''}</option>
          ))}
        </select>
      </label>
      <label className="ins-row">
        <span>แสดง</span>
        <select
          value={object.props?.fieldMetric ?? 'last'}
          onChange={(e) => onPatch({ props: { ...(object.props || {}), fieldMetric: e.target.value } })}
        >
          {FIELD_METRIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
      <label className="ins-row">
        <span>ช่วงเวลา</span>
        <select
          value={object.props?.period ?? ''}
          onChange={(e) => onPatch({ props: { ...(object.props || {}), period: e.target.value || undefined } })}
        >
          {REPORT_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value || 'default'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
      <label className="ins-row">
        <span>ทศนิยม</span>
        <input
          type="number"
          min={0}
          max={6}
          value={styleNum(object, 'decimalPlaces', 2)}
          onChange={(e) => onPatch({ style: mergeStyle(object, { decimalPlaces: Number(e.target.value) }) })}
        />
      </label>
      <label className="ins-row">
        <span>หน่วย</span>
        <input
          value={styleStr(object, 'unit', '')}
          onChange={(e) => onPatch({ style: mergeStyle(object, { unit: e.target.value }) })}
        />
      </label>
    </section>
  );
}

/** Inspector for Formula objects — syncs object.formula and style.formula. */
export function ReportFormulaSection({ object, tags, onPatch }: Pick<ObjectSupplementProps, 'object' | 'tags' | 'onPatch'>) {
  const tagIds = object.tagIds?.length
    ? object.tagIds
    : (object.tagId ? [object.tagId] : []);
  const formula = String(object.formula ?? object.style?.formula ?? 'A');

  const setFormula = (next: string) => {
    onPatch({ formula: next, style: mergeStyle(object, { formula: next }) });
  };

  const addTag = (id: string) => {
    if (!id || tagIds.includes(id)) return;
    const ids = [...tagIds, id];
    onPatch({ tagIds: ids, tagId: ids[0], sourceTagId: ids[0] });
  };

  const removeTag = (id: string) => {
    const ids = tagIds.filter((t) => t !== id);
    onPatch({ tagIds: ids, tagId: ids[0], sourceTagId: ids[0] });
  };

  return (
    <section className="ins-sec">
      <div className="ins-sec-head"><h4>สูตร</h4></div>
      <label className="ins-row">
        <span>สูตรสำเร็จ</span>
        <select
          value=""
          onChange={(e) => {
            const preset = e.target.value;
            if (!preset) return;
            setFormula(preset);
          }}
        >
          <option value="">เลือกสูตรสำเร็จ</option>
          {FORMULA_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>{preset.label} - {preset.hint}</option>
          ))}
        </select>
      </label>
      <label className="ins-row ins-row-stack">
        <span>สูตร</span>
        <input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="A - B"
        />
      </label>
      <label className="ins-row">
        <span>เพิ่มตัวแปร</span>
        <select
          value=""
          onChange={(e) => {
            const token = e.target.value;
            if (!token) return;
            setFormula(formula.trim() ? `${formula.trim()} ${token}` : token);
          }}
        >
          <option value="">เลือก</option>
          {REPORT_FORMULA_INSERT_TOKENS.map((v) => (
            <option key={v.token} value={v.token}>{v.label}</option>
          ))}
        </select>
      </label>
      <div className="formula-token-help">
        <strong>ตัวแปรหลัก</strong>
        <span>@usage = หน่วยใช้จริง</span>
        <span>@rate = ค่าไฟต่อหน่วย</span>
        <span>@grandTotal = ยอดบิลรวม</span>
      </div>
      <label className="ins-row">
        <span>Tag</span>
        <select value="" onChange={(e) => addTag(e.target.value)}>
          <option value="">เลือก</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.unit ? ` (${t.unit})` : ''}</option>
          ))}
        </select>
      </label>
      <ul className="ins-tag-var-list formula-var-list">
        {tagIds.length > 0 ? tagIds.map((id, index) => {
          const tag = tags.find((t) => t.id === id);
          return (
            <li key={id}>
              <strong>{letterForIndex(index)}</strong>
              <span>{tag?.name ?? id}{tag?.unit ? ` (${tag.unit})` : ''}</span>
              <button type="button" className="ins-link-btn" onClick={() => removeTag(id)}>ลบ</button>
            </li>
          );
        }) : (
          <li className="formula-var-empty">
            <strong>A</strong>
            <span>ยังไม่ได้เลือก Tag: เลือกด้านบนเพื่อให้ A/B/C มีความหมาย</span>
          </li>
        )}
      </ul>
      <label className="ins-row">
        <span>ช่วงเวลา</span>
        <select
          value={object.props?.period ?? ''}
          onChange={(e) => onPatch({ props: { ...(object.props || {}), period: e.target.value || undefined } })}
        >
          {REPORT_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value || 'default'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
      <label className="ins-row">
        <span>ทศนิยม</span>
        <input
          type="number"
          min={0}
          max={6}
          value={styleNum(object, 'decimalPlaces', 2)}
          onChange={(e) => onPatch({ style: mergeStyle(object, { decimalPlaces: Number(e.target.value) }) })}
        />
      </label>
    </section>
  );
}

/** Inspector for Meter Billing Table — auto rows from energy tags. */
export function MeterBillingTableSection({ object, tags, devices, onPatch }: ObjectSupplementProps) {
  const scopeMode = object.props?.scopeMode ?? (object.props?.deviceId || object.deviceId ? 'device' : 'project');
  const deviceId = object.props?.scopeDeviceId ?? object.props?.deviceId ?? object.deviceId ?? '';
  const scopedDeviceIds = new Set(resolveReportScopeDeviceIds(devices, object.props ?? {}));
  const selectedTagIds: string[] = object.props?.tagIds ?? [];
  const previewCount = listMeterBillingTags(tags, devices, object.props ?? {}).length;

  const toggleTag = (id: string) => {
    const set = new Set(selectedTagIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = Array.from(set);
    onPatch({
      props: {
        ...(object.props || {}),
        tagIds: next.length ? next : undefined,
        autoInclude: next.length ? false : true,
      },
    });
  };

  return (
    <section className="ins-sec">
      <div className="ins-sec-head"><h4>ตารางมิเตอร์ ({previewCount})</h4></div>
      <label className="ins-row">
        <span>ช่วงเวลา</span>
        <select
          value={object.props?.period ?? ''}
          onChange={(e) => onPatch({ props: { ...(object.props || {}), period: e.target.value || undefined } })}
        >
          {REPORT_PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value || 'default'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
      <label className="ins-check">
        <input
          type="checkbox"
          checked={object.props?.showHeader !== false}
          onChange={(e) => onPatch({ props: { ...(object.props || {}), showHeader: e.target.checked } })}
        />
        <span>หัวตาราง</span>
      </label>
      <div className="ins-sec-head" style={{ marginTop: 10 }}><h4>เลือกพารามิเตอร์วัดค่า (Registers)</h4></div>
      <div className="ins-meter-tag-pick" style={{ maxHeight: 140, overflow: 'auto' }}>
        {tags
          .filter((t) => (scopeMode === 'project' || scopedDeviceIds.size === 0 || scopedDeviceIds.has(t.deviceId)) && isBillingEnergyTag(t))
          .map((t) => (
            <label key={t.id} className="ins-check" style={{ display: 'flex', marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={selectedTagIds.length === 0 ? false : selectedTagIds.includes(t.id)}
                onChange={() => toggleTag(t.id)}
              />
              <span>{t.name}{t.unit ? ` (${t.unit})` : ''}</span>
            </label>
          ))}
      </div>
      {selectedTagIds.length > 0 ? (
        <button
          type="button"
          className="ins-link-btn"
          style={{ marginTop: 6 }}
          onClick={() => onPatch({ props: { ...(object.props || {}), tagIds: undefined, autoInclude: true } })}
        >
          ทั้งหมด
        </button>
      ) : null}
    </section>
  );
}

export function ReportObjectSupplement({ object, tags, devices, onPatch }: ObjectSupplementProps) {
  const deviceId = object.deviceId ?? object.binding?.deviceId ?? '';
  const scopedTags = deviceId ? tags.filter((t) => t.deviceId === deviceId) : tags;
  const tagId = object.tagId ?? object.sourceTagId ?? '';

  return (
    <>
      <section className="ins-sec">
        <div className="ins-sec-head"><h4>วัตถุ</h4></div>
        <label className="ins-row">
          <span>ชื่อ</span>
          <input value={object.name ?? ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </label>
        <div className="ins-grid2" style={{ marginTop: 8 }}>
          <label className="ins-row">
            <span>X</span>
            <input type="number" value={object.x} onChange={(e) => onPatch({ x: Number(e.target.value) })} />
          </label>
          <label className="ins-row">
            <span>Y</span>
            <input type="number" value={object.y} onChange={(e) => onPatch({ y: Number(e.target.value) })} />
          </label>
          <label className="ins-row">
            <span>W</span>
            <input type="number" min={1} value={object.width} onChange={(e) => onPatch({ width: Number(e.target.value) })} />
          </label>
          <label className="ins-row">
            <span>H</span>
            <input type="number" min={1} value={object.height} onChange={(e) => onPatch({ height: Number(e.target.value) })} />
          </label>
        </div>
        <div className="ins-grid2" style={{ marginTop: 8 }}>
          <label className="ins-check">
            <input type="checkbox" checked={object.visible !== false} onChange={(e) => onPatch({ visible: e.target.checked })} />
            แสดง
          </label>
          <label className="ins-check">
            <input type="checkbox" checked={Boolean(object.locked)} onChange={(e) => onPatch({ locked: e.target.checked })} />
            ล็อก
          </label>
        </div>
      </section>

      {['meter_billing_table', 'energy_summary', 'cost_summary', 'trend', 'echart', 'tagtable', 'table', 'graph'].includes(object.type) ? (
        <ReportScopeSection object={object} devices={devices} onPatch={onPatch} />
      ) : null}

      {object.type === 'value' || object.type === 'kpi_value' || object.type === 'kpicard' ? (
        <ReportFieldSection object={object} tags={tags} devices={devices} onPatch={onPatch} />
      ) : null}

      {['trend', 'echart', 'tagtable', 'table', 'graph'].includes(object.type) ? (
        <ReportTagSeriesSection object={object} tags={tags} devices={devices} onPatch={onPatch} />
      ) : null}

      {object.type === 'formulavalue' || object.type === 'formula' ? (
        <ReportFormulaSection object={object} tags={tags} onPatch={onPatch} />
      ) : null}

      {object.type === 'meter_billing_table' ? (
        <MeterBillingTableSection object={object} tags={tags} devices={devices} onPatch={onPatch} />
      ) : null}

      {object.type === 'image' ? (
        <ReportImageSection object={object} onPatch={onPatch} />
      ) : null}

      {object.type === 'date' ? (
        <section className="ins-sec">
          <div className="ins-sec-head"><h4>Date</h4></div>
          <label className="ins-row">
            <span>Format</span>
            <select
              value={object.props?.format ?? 'YYYY-MM-DD'}
              onChange={(e) => onPatch({ props: { ...(object.props || {}), format: e.target.value } })}
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MMMM Do YYYY">MMMM Do YYYY</option>
              <option value="DD MMM YYYY">DD MMM YYYY</option>
            </select>
          </label>
        </section>
      ) : null}

      {['energy_summary', 'cost_summary'].includes(object.type) ? (
        <section className="ins-sec">
          <div className="ins-sec-head"><h4>ข้อมูล</h4></div>
          <label className="ins-row">
            <span>อุปกรณ์</span>
            <select
              value={deviceId}
              onChange={(e) => {
                const nextDevice = e.target.value || undefined;
                onPatch({
                  deviceId: nextDevice,
                  binding: { ...(object.binding ?? {}), deviceId: nextDevice },
                  tagId: undefined,
                  sourceTagId: undefined,
                });
              }}
            >
              <option value="">ทั้งหมด</option>
              {devices.filter((d) => d.type !== 'converter').map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="ins-row">
            <span>Tag</span>
            <select
              value={tagId}
              onChange={(e) => {
                const nextTag = e.target.value || undefined;
                onPatch({ tagId: nextTag, sourceTagId: nextTag, binding: { ...(object.binding ?? {}), tagId: nextTag } });
              }}
            >
              <option value="">เลือก</option>
              {scopedTags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.unit ? ` (${t.unit})` : ''}</option>
              ))}
            </select>
          </label>
          <label className="ins-row">
            <span>ช่วงเวลา</span>
            <select
              value={object.props?.period ?? 'monthly'}
              onChange={(e) => onPatch({ props: { ...(object.props || {}), period: e.target.value } })}
            >
              {REPORT_PERIOD_OPTIONS.filter((o) => o.value).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {object.type === 'page_number' ? (
        <section className="ins-sec">
          <div className="ins-sec-head"><h4>Page Number</h4></div>
          <label className="ins-row">
            <span>Label</span>
            <input
              value={object.text ?? 'Page [n]'}
              onChange={(e) => onPatch({ text: e.target.value })}
            />
          </label>
        </section>
      ) : null}

      {object.type === 'signature' ? (
        <section className="ins-sec">
          <div className="ins-sec-head"><h4>Signature</h4></div>
          <label className="ins-row">
            <span>Caption</span>
            <input
              value={object.text ?? ''}
              onChange={(e) => onPatch({ text: e.target.value })}
            />
          </label>
        </section>
      ) : null}

      {['trend', 'echart'].includes(object.type) ? (
        <ReportChartSettings object={object} onPatch={onPatch} />
      ) : null}

      {object.type === 'qrcode' ? (
        <section className="ins-sec">
          <div className="ins-sec-head"><h4>QR Code</h4></div>
          <label className="ins-row">
            <span>Data</span>
            <input
              value={object.props?.qrData ?? ''}
              onChange={(e) => onPatch({ props: { ...(object.props || {}), qrData: e.target.value } })}
              placeholder="URL or text"
            />
          </label>
        </section>
      ) : null}
    </>
  );
}

export function reportObjectPreviewStyle(object: ReportObjectDefinition): React.CSSProperties {
  return resolveReportObjectChromeStyle(object);
}
