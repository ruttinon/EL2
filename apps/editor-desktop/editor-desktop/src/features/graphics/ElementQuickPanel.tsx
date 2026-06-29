import { Icon } from '@iconify/react';
import type { GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { allSymbols, symbolById } from './graphicSymbols';
import { resolveImageUrl } from './imageHelpers';
import { clampBoxDepth } from './boxDepth';
import type { ImageToGlbMode } from './imageToGlb';
import { ImageToModelGuide } from './ImageToModelGuide';
import { hexForColorInput } from './colorInput';
export { objectNeedsPorts, defaultPortsHint } from './elementPanelUtils';

type ImageItem = { id: string; name: string; dataUrl: string };

const TYPE_LABELS: Record<string, string> = {
  text: 'ข้อความ', rectangle: 'สี่เหลี่ยม', circle: 'วงกลม', line: 'เส้น', panel: 'แผง',
  image: 'รูปภาพ', value: 'ค่า Tag', gauge: 'เกจ', button: 'ปุ่ม', flowpath: 'สายไฟ 2D',
  elecsymbol: 'สัญลักษณ์ไฟฟ้า', bussection: 'Bus Section', feedlabel: 'ป้าย Feeder',
  viewport3d: '3D / โมเดล', zone3d: 'โซนห้อง', zone2d: 'โซน 2D', cable3d: 'สาย 3D',
  hotspot: 'Hotspot', group: 'กลุ่ม',
};

export function ElementQuickPanel({
  object,
  tags,
  images,
  model3dAssets,
  splineAssets = [],
  onUpdate,
  onBindTag,
  onBindFlowTag,
  onPickImage,
  onImportImage,
  onConvertTo3dBox,
  onImportGlb,
  onConvertToGlb,
  onDrawPath,
  onSyncCable,
  onShowAdvanced,
}: {
  object: GraphicObjectDefinition;
  tags: TagSummary[];
  images: ImageItem[];
  model3dAssets: Array<{ id: string; name: string; url: string }>;
  splineAssets: Array<{ id: string; name: string; url: string }>;
  onUpdate: (patch: Partial<GraphicObjectDefinition>) => void;
  onBindTag: (tagId: string) => void;
  onBindFlowTag: (tagId: string) => void;
  onPickImage: (imageId: string) => void;
  onImportImage?: () => void;
  onConvertTo3dBox?: () => void;
  onImportGlb?: () => void;
  onConvertToGlb?: (mode: ImageToGlbMode) => void;
  onDrawPath?: () => void;
  onSyncCable?: () => void;
  onShowAdvanced: () => void;
}) {
  const typeLabel = TYPE_LABELS[object.type] ?? object.type;
  const needsTag = ['value', 'gauge', 'alarm', 'led', 'switch', 'slider', 'elecsymbol', 'statusbadge', 'echart', 'progressbar', 'semaphore', 'inputfield', 'dropdown', 'pipe'].includes(object.type);
  const needsFlow = ['flowpath', 'cable3d', 'feedlabel'].includes(object.type);
  const currentImageUrl = resolveImageUrl(object);
  const sceneTypes = ['image', 'viewport3d', 'elecsymbol', 'rectangle', 'panel', 'zone3d', 'zone2d'];
  const showDepthZ = sceneTypes.includes(object.type);

  return (
    <div className="element-quick-panel">
      <div className="element-quick-header">
        <span className="element-quick-type">{typeLabel}</span>
        <button type="button" className="btn secondary tiny" onClick={onShowAdvanced}>
          <Icon icon="solar:settings-bold-duotone" width="14" height="14" /> ตั้งค่าขั้นสูง
        </button>
      </div>

      <label className="eq-field">ชื่อ
        <input value={object.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      </label>

      {(object.type === 'text' || object.text) && (
        <label className="eq-field">ข้อความแสดง
          <input value={object.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} />
        </label>
      )}

      {needsTag && (
        <label className="eq-field">Tag {object.type === 'elecsymbol' ? '(สถานะ)' : ''}
          <select value={object.binding?.tagId || ''} onChange={(e) => onBindTag(e.target.value)}>
            <option value="">— เลือกภายหลังได้ —</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}{t.unit ? ` (${t.unit})` : ''}</option>)}
          </select>
        </label>
      )}

      {needsFlow && (
        <label className="eq-field">Tag กระแส / ค่า
          <select value={object.binding?.flowTagId || object.binding?.tagId || ''} onChange={(e) => onBindFlowTag(e.target.value)}>
            <option value="">— เลือกภายหลังได้ —</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}{t.unit ? ` (${t.unit})` : ''}</option>)}
          </select>
        </label>
      )}

      {object.type === 'echart' && (
        <>
          <label className="eq-field">ประเภท ECharts
            <select
              value={String(object.style?.echartType ?? 'line')}
              onChange={(e) => onUpdate({ style: { ...object.style, echartType: e.target.value } })}
            >
              <option value="line">Line Chart</option>
              <option value="area">Area Chart</option>
              <option value="bar">Bar Chart (Vertical)</option>
              <option value="bar-h">Bar Chart (Horizontal)</option>
              <option value="pie">Pie Chart</option>
              <option value="donut">Donut Chart</option>
              <option value="gauge">Gauge</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <label className="eq-field" style={{ flex: 1 }}>ต่ำสุด (Min)
              <input type="number" value={Number(object.style?.min ?? 0)} onChange={(e) => onUpdate({ style: { ...object.style, min: Number(e.target.value) } })} />
            </label>
            <label className="eq-field" style={{ flex: 1 }}>สูงสุด (Max)
              <input type="number" value={Number(object.style?.max ?? 100)} onChange={(e) => onUpdate({ style: { ...object.style, max: Number(e.target.value) } })} />
            </label>
          </div>
          <label className="eq-field">หน่วย (Unit)
            <input value={String(object.style?.unit ?? '')} onChange={(e) => onUpdate({ style: { ...object.style, unit: e.target.value } })} />
          </label>
          <div className="eq-hint">สำหรับ Multi-trend (Trend Series หลายเส้น) ให้ใช้ปุ่ม Settings ขั้นสูงเพื่อเพิ่มกราฟหลายแกน</div>
        </>
      )}

      {object.type === 'progressbar' && (
        <>
          <div style={{ display: 'flex', gap: 6 }}>
            <label className="eq-field" style={{ flex: 1 }}>ต่ำสุด (Min)
              <input type="number" value={Number(object.style?.min ?? 0)} onChange={(e) => onUpdate({ style: { ...object.style, min: Number(e.target.value) } })} />
            </label>
            <label className="eq-field" style={{ flex: 1 }}>สูงสุด (Max)
              <input type="number" value={Number(object.style?.max ?? 100)} onChange={(e) => onUpdate({ style: { ...object.style, max: Number(e.target.value) } })} />
            </label>
          </div>
          <label className="eq-field">หน่วย (Unit)
            <input value={String(object.style?.unit ?? '')} onChange={(e) => onUpdate({ style: { ...object.style, unit: e.target.value } })} />
          </label>
          <label className="eq-field">สีแถบ (Fill Color)
            <input type="color" value={String(object.style?.fill ?? '#22c55e')} onChange={(e) => onUpdate({ style: { ...object.style, fill: e.target.value } })} />
          </label>
        </>
      )}

      {(object.type === 'inputfield' || object.type === 'dropdown') && (
        <label className="eq-checkbox">
          <input
            type="checkbox"
            checked={object.style?.confirmWrite === true}
            onChange={(e) => onUpdate({ style: { ...object.style, confirmWrite: e.target.checked } })}
          />
          ถามยืนยันก่อนส่งค่า (Confirm Write)
        </label>
      )}

      {object.type === 'dropdown' && (
        <label className="eq-field">ตัวเลือก (คั่นด้วยลูกน้ำ)
          <textarea
            rows={2}
            value={String(object.style?.options ?? 'Option 1, Option 2')}
            onChange={(e) => onUpdate({ style: { ...object.style, options: e.target.value } })}
            placeholder="เช่น: Auto, Manual, Stop"
          />
        </label>
      )}

      {object.type === 'video' && (
        <label className="eq-field">Video URL
          <input type="url" value={String(object.style?.videoUrl ?? '')} onChange={(e) => onUpdate({ style: { ...object.style, videoUrl: e.target.value } })} placeholder="https://..." />
        </label>
      )}

      {object.type === 'iframe' && (
        <label className="eq-field">iFrame URL
          <input type="url" value={String(object.style?.iframeUrl ?? '')} onChange={(e) => onUpdate({ style: { ...object.style, iframeUrl: e.target.value } })} placeholder="https://..." />
        </label>
      )}

      {object.type === 'pipe' && (
        <label className="eq-field">สีท่อ (Pipe Color)
          <input type="color" value={String(object.style?.fill ?? '#06b6d4')} onChange={(e) => onUpdate({ style: { ...object.style, fill: e.target.value } })} />
        </label>
      )}

      {object.type === 'elecsymbol' && (
        <>
          <label className="eq-field">ประเภทสัญลักษณ์
            <select
              value={String(object.style?.symbolId ?? 'breaker')}
              onChange={(e) => onUpdate({ style: { ...object.style, symbolId: e.target.value, customSymbolId: undefined } })}
            >
              <option value="breaker">Breaker</option>
              <option value="meter">Meter</option>
              <option value="transformer">Transformer</option>
              <option value="motor">Motor</option>
              <option value="door">Door</option>
              <option value="lamp">Lamp</option>
            </select>
          </label>
          <label className="eq-field">Custom SVG (ถ้ามี)
            <select
              value={String(object.style?.customSymbolId ?? '')}
              onChange={(e) => {
                const sym = symbolById(allSymbols(), e.target.value);
                onUpdate({
                  style: {
                    ...object.style,
                    customSymbolId: e.target.value || undefined,
                    customSymbolSvg: sym?.svgContent,
                  },
                });
              }}
            >
              <option value="">— ไม่ใช้ —</option>
              {allSymbols().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </>
      )}

      {object.type === 'image' && (
        <>
          <div className="eq-field">
            <span>รูปภาพ</span>
            <div className="eq-image-actions">
              <button type="button" className="btn secondary tiny" onClick={onImportImage}>
                <Icon icon="solar:upload-bold-duotone" width="14" height="14" /> เลือกไฟล์
              </button>
              {currentImageUrl ? (
                <img src={currentImageUrl} alt="" className="eq-image-thumb" />
              ) : (
                <span className="eq-hint">ลากไฟล์ PNG/JPG มาวางบน canvas</span>
              )}
            </div>
          </div>
          {images.length > 0 && (
            <label className="eq-field">จากคลัง
              <select
                value={images.find((i) => i.dataUrl === currentImageUrl)?.id ?? ''}
                onChange={(e) => { if (e.target.value) onPickImage(e.target.value); }}
              >
                <option value="">— เลือกรูป —</option>
                {images.map((img) => <option key={img.id} value={img.id}>{img.name}</option>)}
              </select>
            </label>
          )}
          <ImageToModelGuide onImportGlb={onImportGlb} />
          {currentImageUrl && onConvertToGlb ? (
            <details className="eq-experimental" style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, cursor: 'pointer', color: '#64748b' }}>ทดลอง: Relief mesh (ไม่ใช่ AI — ผลลัพธ์จำกัด)</summary>
              <label className="eq-field" style={{ marginTop: 8 }}>โหมด
                <select id="glb-mode-select" defaultValue="relief">
                  <option value="relief">Relief</option>
                  <option value="silhouette">Silhouette (PNG)</option>
                </select>
              </label>
              <button
                type="button"
                className="btn secondary tiny"
                style={{ width: '100%' }}
                onClick={() => {
                  const sel = document.getElementById('glb-mode-select') as HTMLSelectElement | null;
                  onConvertToGlb((sel?.value as ImageToGlbMode) || 'relief');
                }}
              >
                สร้าง relief GLB (ทดลอง)
              </button>
            </details>
          ) : null}
        </>
      )}

      {object.type === 'viewport3d' && (
        <>
            <div className="eq-3d-explainer">
              <b>โมเดล GLB</b> = ไฟล์ 3D จริง (import จาก Tripo/Blender)<br />
              <b>Spline</b> = 3D Web Component สวยงาม<br />
              <span className="eq-hint">โหมด “กล่อง CSS” เป็น preview 2.5D ไม่ใช่ mesh จริง</span>
            </div>
            <label className="eq-field">โหมด 3D
              <select
                value={String(object.style?.sceneBuildMode ?? (object.style?.glbUrl ? 'glb' : (object.style?.splineUrl ? 'spline' : 'box')))}
                onChange={(e) => onUpdate({ style: { ...object.style, sceneBuildMode: e.target.value } })}
              >
                <option value="box">กล่อง 3D (ประกอบเอง — ไม่ต้องมี GLB)</option>
                <option value="glb">ไฟล์ GLB/GLTF</option>
                <option value="spline">Spline Component</option>
              </select>
            </label>
            {String(object.style?.sceneBuildMode ?? 'box') === 'glb' && (
              <label className="eq-field">โมเดล 3D
                <select
                  value={String(object.style?.glbUrl ?? '')}
                  onChange={(e) => onUpdate({ style: { ...object.style, glbUrl: e.target.value, sceneBuildMode: 'glb' } })}
                >
                  <option value="">— เลือกจาก Assets —</option>
                  {model3dAssets.map((m) => <option key={m.id} value={m.url}>{m.name}</option>)}
                </select>
              </label>
            )}
            {String(object.style?.sceneBuildMode ?? 'box') === 'spline' && (
              <label className="eq-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>Spline URL (scene.splinecode)
                <div style={{ display: 'flex', width: '100%', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    placeholder="https://prod.spline.design/.../scene.splinecode"
                    value={String(object.style?.splineUrl ?? '')}
                    onChange={(e) => onUpdate({ style: { ...object.style, splineUrl: e.target.value, sceneBuildMode: 'spline' } })}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {splineAssets.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          onUpdate({ style: { ...object.style, splineUrl: e.target.value, sceneBuildMode: 'spline' } });
                        }
                      }}
                      style={{ width: '80px', flexShrink: 0 }}
                    >
                      <option value="">Assets</option>
                      {splineAssets.map((m) => <option key={m.id} value={m.url}>{m.name}</option>)}
                    </select>
                  )}
                </div>
              </label>
            )}
            {String(object.style?.sceneBuildMode ?? 'box') === 'box' && (
            <>
              <label className="eq-field">สีด้านข้าง/บน
                <input type="color" value={String(object.style?.boxColor ?? '#64748b')} onChange={(e) => onUpdate({ style: { ...object.style, boxColor: e.target.value } })} />
              </label>
              <label className="eq-field">ความหนา (px) — ไม่ใช่ mm
                <input
                  type="range"
                  min={12}
                  max={Math.min(120, Math.round(Math.min(object.width, object.height) * 0.35))}
                  value={clampBoxDepth(Number(object.style?.boxDepth ?? 40), object.width, object.height)}
                  onChange={(e) => onUpdate({
                    style: {
                      ...object.style,
                      boxDepth: clampBoxDepth(Number(e.target.value), object.width, object.height),
                    },
                  })}
                />
                <span className="eq-hint">
                  {clampBoxDepth(Number(object.style?.boxDepth ?? 40), object.width, object.height)} px
                  — ความหนาด้านข้าง (12–120) · อย่าใส่ 6000 (นั่นคือ mm ของความสูงตู้)
                </span>
              </label>
              {images.length > 0 && (
                <label className="eq-field">รูปหน้าตู้ (optional)
                  <select
                    value={String(object.style?.boxFaceImage ?? '')}
                    onChange={(e) => onUpdate({ style: { ...object.style, boxFaceImage: e.target.value || undefined } })}
                  >
                    <option value="">— ไม่ใช้รูป —</option>
                    {images.map((img) => <option key={img.id} value={img.dataUrl}>{img.name}</option>)}
                  </select>
                </label>
              )}
              </>
            )}

            {/* ── 3D Data Binding Section ─────────────────────── */}
            <div style={{ borderTop: '1px solid #e5eef4', marginTop: 12, paddingTop: 12 }}>
              <div className="eq-3d-explainer" style={{ fontWeight: 700, color: '#0f4c5c', marginBottom: 8 }}>
                🔗 3D Data Binding (Digital Twin)
              </div>

              {/* Rotation Tag binding — works for all 3D modes */}
              <label className="eq-field">หมุน (Rotation) Tag
                <select
                  value={String(object.binding?.rotate3dTagId ?? '')}
                  onChange={(e) => onUpdate({ binding: { ...object.binding, rotate3dTagId: e.target.value || null } })}
                >
                  <option value="">— ไม่ผูก —</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {object.binding?.rotate3dTagId && (
                <>
                  <label className="eq-field">แกนหมุน
                    <select
                      value={String(object.binding?.rotate3dAxis ?? 'y')}
                      onChange={(e) => onUpdate({ binding: { ...object.binding, rotate3dAxis: e.target.value as 'x' | 'y' | 'z' } })}
                    >
                      <option value="x">X (ก้ม/เงย)</option>
                      <option value="y">Y (หมุนซ้าย/ขวา)</option>
                      <option value="z">Z (ม้วน)</option>
                    </select>
                  </label>
                  <label className="eq-field">ตัวคูณ (° ต่อ 1 หน่วย)
                    <input
                      type="number"
                      step={0.1}
                      value={Number(object.binding?.rotate3dMultiplier ?? 1)}
                      onChange={(e) => onUpdate({ binding: { ...object.binding, rotate3dMultiplier: Number(e.target.value) } })}
                      style={{ width: 80 }}
                    />
                    <span className="eq-hint">เช่น Tag = 50 Hz → 50 × 3.6 = 180°</span>
                  </label>
                </>
              )}

              {/* Spline Variable Mappings — only visible in spline mode */}
              {String(object.style?.sceneBuildMode ?? 'box') === 'spline' && (() => {
                const mappings: Record<string, string> = (object.binding?.splineMappings as Record<string, string>) ?? {};
                const entries = Object.entries(mappings);
                return (
                  <>
                    <div className="eq-3d-explainer" style={{ marginTop: 8 }}>
                      <b>Spline Variables → Tags</b><br />
                      <span className="eq-hint">ตัวแปรใน Spline → ค่า Tag จาก Engine (เช่น speed, rpm, state)</span>
                    </div>
                    {entries.map(([varName, tagId], idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="ชื่อตัวแปร Spline"
                          value={varName}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            const newMap = { ...mappings };
                            delete newMap[varName];
                            if (newKey) newMap[newKey] = tagId;
                            onUpdate({ binding: { ...object.binding, splineMappings: newMap } });
                          }}
                          style={{ flex: 1, minWidth: 0 }}
                        />
                        <select
                          value={tagId}
                          onChange={(e) => {
                            const newMap = { ...mappings, [varName]: e.target.value };
                            onUpdate({ binding: { ...object.binding, splineMappings: newMap } });
                          }}
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <option value="">— เลือก Tag —</option>
                          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button
                          type="button"
                          className="btn danger tiny"
                          style={{ padding: '2px 6px', flexShrink: 0 }}
                          onClick={() => {
                            const newMap = { ...mappings };
                            delete newMap[varName];
                            onUpdate({ binding: { ...object.binding, splineMappings: newMap } });
                          }}
                        >✕</button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn secondary tiny"
                      style={{ width: '100%', marginTop: 4 }}
                      onClick={() => {
                        const newMap = { ...mappings, [`variable${entries.length + 1}`]: '' };
                        onUpdate({ binding: { ...object.binding, splineMappings: newMap } });
                      }}
                    >+ เพิ่ม Spline Variable</button>
                  </>
                );
              })()}
            </div>
          </>
        )}

      {showDepthZ && (
        <label className="eq-field">ความสูง Z (depth)
          <input
            type="range"
            min={0}
            max={120}
            value={Number(object.style?.depthZ ?? 0)}
            onChange={(e) => onUpdate({ style: { ...object.style, depthZ: Number(e.target.value) } })}
          />
          <span className="eq-hint">{Number(object.style?.depthZ ?? 0)} — ยิ่งสูงยิ่งลอยเหนือพื้น · ปรับความลึก 3D ด้านล่าง</span>
        </label>
      )}

      {(object.type === 'flowpath' || object.type === 'cable3d') && onDrawPath && (
        <button type="button" className="btn secondary" style={{ width: '100%', marginTop: 8 }} onClick={onDrawPath}>
          วาด / แก้จุดเส้น
        </button>
      )}

      {object.type === 'cable3d' && onSyncCable && (
        <button type="button" className="btn secondary tiny" style={{ marginTop: 6 }} onClick={onSyncCable} disabled={!object.style?.linkedWireId}>
          Sync จากสาย 2D
        </button>
      )}

      {object.type === 'bussection' && (
        <div className="eq-hint">Bus มี tap ports — ใช้ Wire Tool ต่อจากจุดวงกลมบนเส้น Bus</div>
      )}

      {['rectangle', 'panel', 'circle'].includes(object.type) && (
        <label className="eq-field">สีพื้น
          <input type="color" value={hexForColorInput(object.style?.background ?? object.style?.fill, '#ffffff')} onChange={(e) => onUpdate({ style: { ...object.style, background: e.target.value, fill: e.target.value } })} />
        </label>
      )}

      <div className="eq-hint muted" style={{ marginTop: 10, fontSize: 11 }}>
        ยังไม่ผูก Tag ก็ Save ได้ — Validate จะเตือนก่อนรัน Monitor
      </div>
    </div>
  );
}

