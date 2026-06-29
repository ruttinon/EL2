# Scene Script — สร้างห้องไฟฟ้า + GLB จากสคริป (ฟรี)

## ใช้งานใน Editor

1. เปิด Graphic → แท็บ **Properties → Script**
2. เลือกตัวอย่าง **ห้อง MCC** หรือแก้ JSON
3. กด **สร้าง Scene (แทนที่)** — รอสักครู่
4. กด **Live** — หมุนดูตู้ GLB (model-viewer)

## รูปแบบสคริป (version 1)

```json
{
  "version": 1,
  "mmPerPx": 10,
  "room": { "widthMm": 6000, "depthMm": 4000, "label": "ห้อง MCC" },
  "equipment": [
    {
      "id": "mcc1",
      "kind": "mcc",
      "name": "MCC-1",
      "xMm": 600,
      "yMm": 800,
      "widthMm": 800,
      "heightMm": 2000,
      "depthMm": 600,
      "breakerRows": 8,
      "generateGlb": true
    }
  ],
  "wires": [
    { "from": "bus_main.out", "to": "mcc1.in" }
  ]
}
```

### kind ที่รองรับ

| kind | ผลลัพธ์ |
|------|---------|
| `mcc`, `panel` | **GLB จริง** (Three.js) + viewport3d |
| `meter`, `breaker`, `transformer`, `motor` | elecsymbol |
| `bus` | bussection + tap ports |
| `wall` | panel |

### wires

ใช้ `equipment.id` + port: `mcc1.out`, `bus_main.tap2`, `meter1.in`

---

## Blender (ฟรี — โมเดลละเอียดกว่า)

1. ใน Script tab กด **Blender .py**
2. เปิด Blender → Scripting → Run
3. File → Export → **glTF Binary (.glb)**
4. Setup → Assets → import GLB

ไฟล์ต้นฉบับ: `scripts/blender/mcc_cabinet.py`

---

## ข้อจำกัด

- **ไม่ใช่ AI** — ไม่แปลงรูpถ่ายเป็นตู้ 3D อัตโนมัติ
- GLB จากสคริป = **ตู้ parametric** ตาม mm ที่ใส่
- รูp → 3D สมจริง = ใช้ Blender script หรือ Tripo แล้ว import GLB
