/** Standard SCADA equipment states for status / multistate widgets. */
export const SCADA_STATE_SLOTS = [
  { value: 0, label: 'Stopped', color: '#64748b' },
  { value: 1, label: 'Running', color: '#22c55e' },
  { value: 2, label: 'Fault', color: '#ef4444' },
  { value: 3, label: 'Comm Fail', color: '#f97316' },
] as const;

export const SCADA_STATE_SLOTS_JSON = JSON.stringify(SCADA_STATE_SLOTS);

export const SCADA_BADGE_MAP =
  '0:Stopped:#64748b,1:Running:#22c55e,2:Fault:#ef4444,3:Comm Fail:#f97316';

export const SCADA_STATES_LABELS = SCADA_STATE_SLOTS.map((s) => s.label).join(',');

export type ScreenTemplateId =
  | 'blank'
  | 'energy_dashboard'
  | 'sld'
  | 'floor_plan'
  | 'riser_diagram'
  | 'meter_monitoring'
  | 'alarm_overview'
  | 'building_3d'
  | 'html_overlay'
  | 'glb_building';

export const SCREEN_TEMPLATES: { id: ScreenTemplateId; label: string; description: string }[] = [
  { id: 'blank', label: 'Blank Canvas (หน้าจอเปล่า)', description: 'เริ่มจากศูนย์ ออกแบบตามสไตล์ของคุณ' },
  { id: 'energy_dashboard', label: 'Energy Dashboard (แดชบอร์ดพลังงาน)', description: 'แสดงข้อมูล kWh, Demand, คาร์บอน และชาร์จแนวโน้มหลัก' },
  { id: 'sld', label: 'Single Line Diagram (ไดอะแกรมไฟฟ้า)', description: 'แสดงระบบไฟฟ้ากำลัง Incomer, Busbar, Breaker และ Meter' },
  { id: 'floor_plan', label: 'Floor Plan (แผนผังโรงงาน/อาคาร)', description: 'แสดงข้อมูลมิเตอร์ตามพิกัดแผนผังหรือแผนที่พื้นที่' },
  { id: 'riser_diagram', label: 'Riser Diagram (ไดอะแกรมแนวตั้ง)', description: 'แสดงการกระจายสายส่งไฟฟ้ากำลังเชื่อมระหว่างชั้นอาคาร' },
  { id: 'meter_monitoring', label: 'Meter Monitoring (มอนิเตอร์มิเตอร์ละเอียด)', description: 'โฟกัสเจาะลึกเฉพาะมิเตอร์ตัวหลัก ค่ากระแส แรงดัน และโหลด' },
  { id: 'alarm_overview', label: 'Alarm Overview (หน้าหลักแจ้งเตือน)', description: 'ตารางสรุปรายการ Alarm ที่กำลังแจ้งเตือนของระบบทั้งหมด' },
  { id: 'building_3d', label: 'Building 3D Overlay (แสดงผล 3D อาคาร)', description: 'มอนิเตอร์บนภาพโมเดลอาคาร 3 มิติเพื่อความสมจริง' },
  { id: 'html_overlay', label: 'HTML Overlay (มอนิเตอร์บนเว็บสำเร็จรูป)', description: 'แสดงผล widgets ผูกบนหน้า HTML สำเร็จรูป' },
  { id: 'glb_building', label: 'GLB Building (หน้าจอ GLB Model)', description: 'แสดงผลบนโมเดล 3D แบบ GLB' },
];

export function getTemplateInitialObjects(template: ScreenTemplateId, width: number, height: number): any[] {
  switch (template) {
    case 'energy_dashboard':
      return [
        {
          id: 'obj_header',
          type: 'rectangle',
          x: 0,
          y: 0,
          width: width,
          height: 60,
          layer: 1,
          style: { background: '#1e293b', fill: '#1e293b', borderWidth: 0 }
        },
        {
          id: 'obj_title',
          type: 'text',
          x: 20,
          y: 15,
          width: 350,
          height: 30,
          text: 'Energy Management Dashboard',
          layer: 2,
          style: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' }
        },
        {
          id: 'obj_kpi_kwh',
          type: 'kpicard',
          x: 20,
          y: 80,
          width: 250,
          height: 120,
          text: 'Total Active Energy',
          layer: 2,
          style: { background: '#0f172a', color: '#10b981', valueUnit: 'kWh' }
        },
        {
          id: 'obj_kpi_demand',
          type: 'kpicard',
          x: 290,
          y: 80,
          width: 250,
          height: 120,
          text: 'Peak Demand',
          layer: 2,
          style: { background: '#0f172a', color: '#f59e0b', valueUnit: 'kW' }
        },
        {
          id: 'obj_kpi_cost',
          type: 'kpicard',
          x: 560,
          y: 80,
          width: 250,
          height: 120,
          text: 'Energy Cost',
          layer: 2,
          style: { background: '#0f172a', color: '#3b82f6', valueUnit: 'THB' }
        },
        {
          id: 'obj_kpi_carbon',
          type: 'kpicard',
          x: 830,
          y: 80,
          width: 250,
          height: 120,
          text: 'CO2 Emission',
          layer: 2,
          style: { background: '#0f172a', color: '#8b5cf6', valueUnit: 'kgCO2' }
        },
        {
          id: 'obj_chart_trend',
          type: 'trend',
          x: 20,
          y: 220,
          width: 520,
          height: 300,
          layer: 2,
          style: { title: 'Energy Trend (24h)', period: '24h' }
        },
        {
          id: 'obj_table_alarm',
          type: 'alarmtable',
          x: 560,
          y: 220,
          width: 520,
          height: 300,
          layer: 2,
          style: { title: 'Active Alarms' }
        }
      ];

    case 'sld':
      return [
        {
          id: 'obj_inc_label',
          type: 'text',
          x: 100,
          y: 50,
          width: 200,
          height: 30,
          text: 'Main Incomer 22kV',
          layer: 1,
          style: { color: '#ef4444', fontWeight: 'bold' }
        },
        {
          id: 'obj_busbar',
          type: 'rectangle',
          x: 100,
          y: 100,
          width: 800,
          height: 8,
          layer: 1,
          style: { background: '#eab308', fill: '#eab308', borderWidth: 0 }
        },
        {
          id: 'obj_breaker_main',
          type: 'breaker',
          x: 200,
          y: 150,
          width: 60,
          height: 60,
          layer: 2,
          style: { label: 'Main VCB' }
        },
        {
          id: 'obj_breaker_f1',
          type: 'breaker',
          x: 400,
          y: 150,
          width: 60,
          height: 60,
          layer: 2,
          style: { label: 'Feeder 1' }
        },
        {
          id: 'obj_breaker_f2',
          type: 'breaker',
          x: 600,
          y: 150,
          width: 60,
          height: 60,
          layer: 2,
          style: { label: 'Feeder 2' }
        },
        {
          id: 'obj_transformer',
          type: 'elecsymbol',
          x: 200,
          y: 250,
          width: 60,
          height: 60,
          layer: 2,
          style: { symbolId: 'transformer', label: 'TX-01 2000kVA' }
        },
        {
          id: 'obj_meter_main',
          type: 'elecsymbol',
          x: 300,
          y: 250,
          width: 50,
          height: 50,
          layer: 2,
          style: { symbolId: 'meter', label: 'Main PM' }
        },
        {
          id: 'obj_cable_1',
          type: 'flowpath',
          x: 230,
          y: 108,
          width: 4,
          height: 42,
          layer: 1,
          style: { pathPoints: '230,108 230,150', color: '#10b981' }
        },
        {
          id: 'obj_lamp_status',
          type: 'status',
          x: 310,
          y: 150,
          width: 40,
          height: 40,
          layer: 2,
          style: { statusVariant: 'lamp', label: 'VCB Closed' }
        }
      ];

    case 'floor_plan':
      return [
        {
          id: 'obj_floor_bg',
          type: 'rectangle',
          x: 20,
          y: 80,
          width: width - 40,
          height: height - 120,
          layer: 1,
          style: { background: '#1e293b', fill: '#1e293b', borderWidth: 1, borderColor: '#475569' }
        },
        {
          id: 'obj_floor_title',
          type: 'text',
          x: 30,
          y: 25,
          width: 250,
          height: 30,
          text: 'Factory Floor Plan',
          layer: 2,
          style: { color: '#38bdf8', fontSize: 18, fontWeight: 'bold' }
        },
        {
          id: 'obj_mc_1',
          type: 'kpicard',
          x: 100,
          y: 150,
          width: 200,
          height: 100,
          text: 'Production Line A',
          layer: 2,
          style: { background: '#0f172a', valueUnit: 'kW' }
        },
        {
          id: 'obj_mc_2',
          type: 'kpicard',
          x: 400,
          y: 150,
          width: 200,
          height: 100,
          text: 'Production Line B',
          layer: 2,
          style: { background: '#0f172a', valueUnit: 'kW' }
        },
        {
          id: 'obj_nav_btn',
          type: 'button',
          x: width - 200,
          y: 20,
          width: 150,
          height: 45,
          text: 'Go to 2nd Floor',
          layer: 2,
          style: { buttonVariant: 'primary' }
        }
      ];

    case 'riser_diagram':
      return [
        {
          id: 'obj_riser_f3',
          type: 'text',
          x: 50,
          y: 100,
          width: 100,
          height: 30,
          text: '3rd Floor',
          layer: 1,
          style: { color: '#94a3b8', fontWeight: 'bold' }
        },
        {
          id: 'obj_riser_f2',
          type: 'text',
          x: 50,
          y: 200,
          width: 100,
          height: 30,
          text: '2nd Floor',
          layer: 1,
          style: { color: '#94a3b8', fontWeight: 'bold' }
        },
        {
          id: 'obj_riser_f1',
          type: 'text',
          x: 50,
          y: 300,
          width: 100,
          height: 30,
          text: '1st Floor',
          layer: 1,
          style: { color: '#94a3b8', fontWeight: 'bold' }
        },
        {
          id: 'obj_main_busduct',
          type: 'rectangle',
          x: 200,
          y: 80,
          width: 12,
          height: 280,
          layer: 1,
          style: { background: '#f59e0b', fill: '#f59e0b' }
        },
        {
          id: 'obj_meter_f3',
          type: 'elecsymbol',
          x: 250,
          y: 90,
          width: 50,
          height: 50,
          layer: 2,
          style: { symbolId: 'meter', label: 'PM-F3' }
        },
        {
          id: 'obj_meter_f2',
          type: 'elecsymbol',
          x: 250,
          y: 190,
          width: 50,
          height: 50,
          layer: 2,
          style: { symbolId: 'meter', label: 'PM-F2' }
        },
        {
          id: 'obj_meter_f1',
          type: 'elecsymbol',
          x: 250,
          y: 290,
          width: 50,
          height: 50,
          layer: 2,
          style: { symbolId: 'meter', label: 'PM-F1' }
        }
      ];

    case 'meter_monitoring':
      return [
        {
          id: 'obj_mon_title',
          type: 'text',
          x: 20,
          y: 20,
          width: 300,
          height: 30,
          text: 'Meter Detailed Monitoring',
          layer: 2,
          style: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
        },
        {
          id: 'obj_kpi_kwh',
          type: 'kpicard',
          x: 20,
          y: 70,
          width: 250,
          height: 100,
          text: 'Active Energy',
          layer: 2,
          style: { background: '#0f172a', valueUnit: 'kWh' }
        },
        {
          id: 'obj_load_gauge',
          type: 'gauge',
          x: 290,
          y: 70,
          width: 250,
          height: 180,
          text: 'Active Power (kW)',
          layer: 2,
          style: { minValue: 0, maxValue: 1000 }
        },
        {
          id: 'obj_val_v',
          type: 'value',
          x: 560,
          y: 70,
          width: 200,
          height: 40,
          text: 'Voltage L-N',
          layer: 2,
          style: { label: 'Voltage', valueUnit: 'V' }
        },
        {
          id: 'obj_val_a',
          type: 'value',
          x: 560,
          y: 130,
          width: 200,
          height: 40,
          text: 'Current Avg',
          layer: 2,
          style: { label: 'Current', valueUnit: 'A' }
        }
      ];

    case 'alarm_overview':
      return [
        {
          id: 'obj_alarm_title',
          type: 'text',
          x: 20,
          y: 20,
          width: 250,
          height: 30,
          text: 'Alarm Active Overview',
          layer: 2,
          style: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
        },
        {
          id: 'obj_alarm_table',
          type: 'alarmtable',
          x: 20,
          y: 70,
          width: width - 40,
          height: height - 120,
          layer: 2
        }
      ];

    case 'building_3d':
      return [
        {
          id: 'obj_b3d_title',
          type: 'text',
          x: 20,
          y: 20,
          width: 300,
          height: 30,
          text: 'Building 3D Heatmap',
          layer: 2,
          style: { color: '#38bdf8', fontSize: 18, fontWeight: 'bold' }
        }
      ];

    default:
      return [];
  }
}
