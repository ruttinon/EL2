import { useState, useMemo, useEffect } from 'react';
import type { DeviceSummary, TagSummary } from '@energylink/shared-types';
import { tagsForDevice } from '@energylink/widget-registry';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { editorRuntimeApi } from '../../../../api/editorRuntimeApi';

export type BindingPayload = {
  deviceId?: string;
  meterId?: string;
  tagId?: string;
  registerAddress?: string;
  registerName?: string;
  functionCode?: string;
  dataType?: string;
  unit?: string;
  role?: 'value' | 'status' | 'command' | 'trend' | 'alarm' | 'navigation';
  energyRole?: string;
  scale?: number;
  offset?: number;
  ctRatio?: number;
  ptRatio?: number;
};

export type BindingWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  devices: DeviceSummary[];
  tags: TagSummary[];
  liveValues?: Array<{ tagId: string; value: any }>;
  initialBinding?: BindingPayload;
  onApply: (binding: BindingPayload) => void;
};

const ROLES = [
  { id: 'value', label: 'Value (ค่ามอนิเตอร์ทั่วไป)', desc: 'แสดงตัวเลข พาวเวอร์ หรืออุณหภูมิ' },
  { id: 'status', label: 'Status (สถานะเปิด/ปิด)', desc: 'แสดงไฟสถานะ โชว์กราฟิก Run/Stop' },
  { id: 'command', label: 'Command (คำสั่งควบคุม)', desc: 'ผูกกับปุ่ม สวิตช์ หรือช่องอินพุตคำสั่ง' },
  { id: 'trend', label: 'Trend (แนวโน้ม/ประวัติ)', desc: 'ผูกกับกราฟมอนิเตอร์ย้อนหลัง' },
  { id: 'alarm', label: 'Alarm (แจ้งเตือน)', desc: 'ผูกกับสัญญาณเสียงเตือน หรือตาราง Alarm' },
  { id: 'navigation', label: 'Navigation (เปลี่ยนหน้าจอ)', desc: 'ผูกกับปุ่มนำทางไปหน้าย่อยต่าง ๆ' },
] as const;

export function BindingWizard({
  isOpen,
  onClose,
  devices,
  tags,
  liveValues = [],
  initialBinding,
  onApply,
}: BindingWizardProps) {
  const [step, setStep] = useState(1);
  const [deviceId, setDeviceId] = useState(initialBinding?.deviceId ?? '');
  const [tagId, setTagId] = useState(initialBinding?.tagId ?? '');
  const [role, setRole] = useState<BindingPayload['role']>(initialBinding?.role ?? 'value');

  // Register details
  const [scale, setScale] = useState(initialBinding?.scale ?? 1);
  const [offset, setOffset] = useState(initialBinding?.offset ?? 0);
  const [ctRatio, setCtRatio] = useState(initialBinding?.ctRatio ?? 1);
  const [ptRatio, setPtRatio] = useState(initialBinding?.ptRatio ?? 1);
  const [energyRole, setEnergyRole] = useState(initialBinding?.energyRole ?? 'total_kwh');

  const [localLiveValues, setLocalLiveValues] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || step !== 4 || !tagId) return;
    let active = true;
    const fetchVal = async () => {
      const res = await editorRuntimeApi.getCurrentValues();
      if (active && res.ok) {
        setLocalLiveValues(res.data.values ?? []);
      }
    };
    void fetchVal();
    const interval = setInterval(fetchVal, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen, step, tagId]);

  const selectedDevice = useMemo(() => devices.find((d) => d.id === deviceId), [devices, deviceId]);
  const scopedTags = useMemo(() => (deviceId ? tagsForDevice(tags, deviceId) : tags), [tags, deviceId]);
  const selectedTag = useMemo(() => tags.find((t) => t.id === tagId), [tags, tagId]);

  const liveValue = useMemo(() => {
    if (!tagId) return null;
    const fromProps = liveValues.find((v) => v.tagId === tagId)?.value;
    if (fromProps !== undefined) return fromProps;
    return localLiveValues.find((v) => v.tagId === tagId)?.value ?? null;
  }, [liveValues, localLiveValues, tagId]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 1 && !deviceId) return;
    if (step === 2 && !tagId) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const handleFinish = () => {
    const payload: BindingPayload = {
      deviceId: deviceId || undefined,
      meterId: deviceId || undefined, // matching SCADA convention
      tagId: tagId || undefined,
      registerAddress: selectedTag?.address ?? undefined,
      registerName: selectedTag?.name ?? undefined,
      dataType: selectedTag?.dataType ?? undefined,
      unit: selectedTag?.unit ?? undefined,
      role,
      energyRole,
      scale,
      offset,
      ctRatio,
      ptRatio,
    };
    onApply(payload);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          width: 500,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a', fontWeight: 700 }}>
              🪄 ผูกข้อมูลอุปกรณ์ (Binding Wizard)
            </h3>
            <span style={{ fontSize: 11, color: '#64748b' }}>ตั้งค่าการผูกโยงมิเตอร์และวิเคราะห์ค่าแบบปลอดภัย</span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Steps Progress Indicator */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                padding: '10px 4px',
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 'bold',
                color: step === s ? '#2563eb' : step > s ? '#10b981' : '#94a3b8',
                borderBottom: step === s ? '3px solid #2563eb' : step > s ? '3px solid #10b981' : '3px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              Step {s}
            </div>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ padding: 20, flex: 1, overflowY: 'auto', maxHeight: 350 }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>1. เลือกอุปกรณ์ / มิเตอร์ (Select Device)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {devices.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setDeviceId(d.id);
                      setTagId(''); // Reset tag selection
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      border: deviceId === d.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: deviceId === d.id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: '#1e293b' }}>{d.name ?? d.id}</strong>
                      <span style={{ fontSize: 10, color: '#64748b' }}>ID: {d.id}</span>
                    </div>
                    {deviceId === d.id && <Check size={16} color="#2563eb" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>2. เลือก Tag / Register</h4>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                อุปกรณ์: <strong>{selectedDevice?.name ?? deviceId}</strong>
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scopedTags.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setTagId(t.id)}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      border: tagId === t.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: tagId === t.id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: '#1e293b' }}>{t.name ?? t.id}</strong>
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        Address: {t.address ?? 'N/A'} {t.unit ? `(${t.unit})` : ''}
                      </span>
                    </div>
                    {tagId === t.id && <Check size={16} color="#2563eb" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>3. บทบาทของข้อมูล (Choose Role)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ROLES.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      border: role === r.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: role === r.id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', color: '#1e293b' }}>{r.label}</strong>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{r.desc}</span>
                    </div>
                    {role === r.id && <Check size={16} color="#2563eb" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>4. รายละเอียดและค่าจริง (Live Value & Scaling)</h4>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div>
                  <strong>Device:</strong> {selectedDevice?.name ?? deviceId}
                </div>
                <div>
                  <strong>Tag:</strong> {selectedTag?.name ?? tagId}
                </div>
                <div>
                  <strong>Address:</strong> {selectedTag?.address ?? 'N/A'} (FC: {selectedTag?.functionCode ?? 'N/A'})
                </div>
                <div>
                  <strong>Data Type:</strong> {selectedTag?.dataType ?? 'N/A'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <strong>ค่าจริงจากเครื่องจักร (Live Value):</strong>
                  <span
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    {liveValue !== null ? String(liveValue) : '—'}{' '}
                    {String(selectedTag?.unit || '')}
                  </span>
                </div>
              </div>

              {/* Scaling Input parameters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#475569' }}>ตั้งค่าตัวแปรสเกล (Scaling/Ratios)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#475569' }}>
                    CT Ratio
                    <input
                      type="number"
                      value={ctRatio}
                      onChange={(e) => setCtRatio(Number(e.target.value))}
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#475569' }}>
                    PT Ratio
                    <input
                      type="number"
                      value={ptRatio}
                      onChange={(e) => setPtRatio(Number(e.target.value))}
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#475569' }}>
                    Scale Factor
                    <input
                      type="number"
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#475569' }}>
                    Offset
                    <input
                      type="number"
                      value={offset}
                      onChange={(e) => setOffset(Number(e.target.value))}
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#475569', marginTop: 4 }}>
                  Energy Role
                  <select
                    value={energyRole}
                    onChange={(e) => setEnergyRole(e.target.value)}
                    style={{ padding: 4, borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 11 }}
                  >
                    <option value="total_kwh">total_kwh (พลังงานสะสมรวม)</option>
                    <option value="demand_kw">demand_kw (ดีมานด์สูงสุด)</option>
                    <option value="status">status (สถานะการทำรอบ)</option>
                    <option value="command">command (สั่งควบคุม)</option>
                    <option value="alarm">alarm (สัญญาณแจ้งเหตุ)</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          {step > 1 ? (
            <button
              onClick={handleBack}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={16} /> กลับ
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={(step === 1 && !deviceId) || (step === 2 && !tagId)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: (step === 1 && !deviceId) || (step === 2 && !tagId) ? '#cbd5e1' : '#2563eb',
                color: '#ffffff',
                cursor:
                  (step === 1 && !deviceId) || (step === 2 && !tagId) ? 'not-allowed' : 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 'bold',
              }}
            >
              ถัดไป <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Check size={16} /> บันทึกการผูกข้อมูล (Apply)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
