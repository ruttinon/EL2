# Graphics SLD Guide

คู่มือสร้างหน้า Single-Line Diagram (SLD) ใน EnergyL2 Editor

## ขั้นตอนพื้นฐาน

1. **New Graphic** → เลือก template (MCC Room, Feeder Line, Transformer Room)
2. **Setup → Images** → อัปโหลดรูป SLD จาก CAD/Figma เป็น PNG
3. Canvas properties → **Canvas Background Image** → เลือกรูป
4. วาง **Flow Path** ทับสายไฟ → ลากจุดวงกลมปรับเส้น
5. วาง **Elec Symbol** ที่ breaker/transformer/meter
6. Bind tags ใน **SLD / Single-Line** properties
7. **Save** → ดูใน Monitor

## Flow Path

| Property | ความหมาย |
|----------|-----------|
| Flow Tag | กระแส / kW / kWh ที่ใช้ควบคุม animation |
| Enable Tag | breaker ปิด (1/ON) ถึงจะไหล (optional) |
| Flow Threshold | ค่าขั้นต่ำเริ่ม animate (เช่น 0.5 A) |
| Overload (Alarm High) | เกินค่านี้ → เส้นแดงเรืองแสง |
| Path Points | `x,y;x,y` ในกรอบ object |

**แก้ path:** เลือก object → ลากจุดวงกลม หรือกด Draw Path แล้วคลิกเพิ่มจุด

## Elec Symbol

| Symbol | State Tag |
|--------|-----------|
| Breaker | 0=open, 1=closed, 2=trip (กระพริบแดง) |
| Motor / Generator | 0=stop, 1=run |
| ATS | 0=manual, 1=auto |
| CT / PT / Transformer / Bus | แสดงสัญลักษณ์คงที่ |

## Export รูปจาก CAD

- AutoCAD: Plot → PNG ความละเอียด 1920px ขึ้นไป
- จัด scale ให้ตรงกับ canvas size (เช่น 1400×800)
- วาง flow path และ symbol ทับตำแหน่งจริง

## ข้อมูล

Runtime อ่านค่าจาก Engine เท่านั้น — ไม่มี mock data
