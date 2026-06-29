# Scene Builder Vision — แนว The Sims สำหรับระบบไฟฟ้า

## สิ่งที่คุณต้องการ (สรุป)

- ประกอบอาคาร/ห้อง/ตู้ไฟเอง ไม่ใช่แค่ import ไฟล์ 3D สำเร็จรูป
- มีทั้งภายนอกและภายใน — ตู้ MCC, มิเตอร์, สายไฟ, กระแสไหล
- ใช้งานง่ายเหมือนเกม The Sims (ลากวาง, snap, ชั้น/ห้อง)

## ทำได้จริงไหม?

**ได้ — แต่ไม่ใช่ “เอารูป 2D แล้ว AI สร้างโมเดล 3D อัตโนมัติ” ในทันที**

| แนวทาง | ความเป็นไปได้ | เหมาะกับ EnergyL2 |
|--------|----------------|-------------------|
| Import GLB/GLTF ทั้งตึก | ทำได้แล้ว (Setup → Assets) | ดีสำหรับ exterior สำเร็จรูป |
| **Modular Scene Builder** (กล่อง/ผนัง/พื้น + อุปกรณ์ snap) | **Phase 15–17 ✅** | ใกล้ The Sims ที่สุด |
| รูป 2D → โมเดล 3D อัตโนมัติ | ต้องใช้ AI/photogrammetry แยก | ยังไม่ practical ใน editor |
| รูป 2D เป็น “billboard” ใน scene 3D | ทำได้แล้ว (Image + Isometric) | เร็วสำหรับตู้/มิเตอร์ |
| สายไฟ + กระแส | ทำได้แล้ว (flowpath, cable3d, pipe, wire tool) | ครบสำหรับ SCADA |

## แนวทางที่เร็วและยืดหยุ่นที่สุด (แนะนำ)

### ชั้นที่ 1 — 2.5D Isometric Builder ✅

1. **Scene Catalog:** Floor Tile, Wall, 3D Box (ตู้), Meter, Breaker
2. **Isometric preview** บน canvas (ปุ่ม Isometric + R3f layer)
3. **Wire Tool** ต่อ port ระหว่างอุปกรณ์
4. **zone3d / zone2d** แบ่งชั้น/ห้อง + drill-down ไป graphic ลูก

→ ไม่ต้องมี GLB ก็ประกอบห้อง MDB ได้

### ชั้นที่ 2 — Modular 3D (Phase 15–17 ✅)

- **Grid snap 3D** + **Wall chain** — ✅
- **Room fill** (polygon 3+ มุม) + **Detect Room** จาก wall loop — ✅
- **Snap wire to port** + **snap equipment to wall** — ✅
- **Measure tool** + **Ungroup** — ✅
- **Equipment kit:** ATS, Generator, Panel Board — ✅
- **Floor stack:** ชั้น 1, 2, 3 สลับมอง (floor filter bar)
- **Interior:** graphic ลูกต่อ graphic แม่ (`navigateTo` + back stack)

### ชั้นที่ 3 — Optional GLB

- อาคาร exterior จาก SketchUp/Blender → export GLB
- ภายในยังใช้ modular + SLD overlay
- FBX/OBJ → stage ที่ Engine แล้ว convert ภายนอก — ดู [ASSET_CONVERT_PIPELINE.md](./ASSET_CONVERT_PIPELINE.md)

## รูป → โมเดล 3D ได้ไหม?

- **รูป → 3D Box (ใน editor):** ทำได้แล้ว — วางรูป → Properties → **แปลงเป็น 3D Box** หรือเลือกรูปเป็น `boxFaceImage` บน viewport3d
- **รูป → mesh 3D จริง (GLB):** ต้อง tool ภายนอก (Blender, Tripo) — ยังไม่ auto ใน editor
- **แกน Z:** ใช้ `depthZ` + `boxDepth` + เปิด **Isometric** — จัดชั้น/ความลึกได้

## ใส่รูป / ต่อสาย

1. **รูป:** ลากไฟล์มาวาง canvas · คลิก Image tool · **Setup → Assets**
2. **Wire:** ปุ่ม Wire อยู่เหนือ palette → คลิก port ฟ้า (Out) → port ส้ม (In)
3. **Feeder label บนเส้น:** เลือก flowpath/cable3d → เปิด **Show feeder label on wire**
4. Port แสดงเมื่อเลือก Wire tool หรือเลือกวัตถุที่มี port

## Workflow แนะนำตอนนี้

1. สร้าง Graphic → แท็บ **Scene** → ลาก **Floor** → **Wall** → **3D Box**
2. เปิด **Isometric** ดูมุมมอง 3D
3. ลาก **Breaker / Meter** จาก Catalog
4. **Wire Tool:** คลิก port Out → port In
5. เลือกวัตถุ → **Element (Quick)** → ผูก Tag
6. **Save** → **Live** ทดสอบ

---

**ถัดไป (optional):** ดู [GRAPHICS_ROADMAP.md](./GRAPHICS_ROADMAP.md) § Future — particle cable ใน viewport3d, asset server ร่วม, native convert/RTSP
