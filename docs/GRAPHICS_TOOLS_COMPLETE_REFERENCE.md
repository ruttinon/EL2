# EnergyL2 Graphics — แผนและรายละเอียด Tools / Properties ฉบับสมบูรณ์

เอกสารนี้รวม **แผนตั้งแต่แรก**, **ทุก tool + properties**, **รูปแบบไฟล์**, **สิ่งที่ต้องเพิ่ม/แก้**, และ **Prompt สำหรับ AI** ในที่เดียว

อ้างอิงเพิ่ม: [GRAPHICS_TOOLS_MASTER_PLAN.md](./GRAPHICS_TOOLS_MASTER_PLAN.md) · [GRAPHICS_ROADMAP.md](./GRAPHICS_ROADMAP.md)

---

## สารบัญ

1. [เป้าหมายและหลักการ](#1-เป้าหมายและหลักการ)
2. [แผน Phase ทั้งหมด (Phase 1–14)](#2-แผน-phase-ทั้งหมด-phase-114)
3. [Editor Tools (ไม่ใช่ object บน canvas)](#3-editor-tools-ไม่ใช่-object-บน-canvas)
4. [Property Layers มาตรฐาน](#4-property-layers-มาตรฐาน)
5. [Canvas Object Types — รายละเอียดทุกตัว (34 types)](#5-canvas-object-types--รายละเอียดทุกตัว-34-types)
6. [Scene Catalog & Asset Library](#6-scene-catalog--asset-library)
7. [Port & Wiring Model](#7-port--wiring-model)
8. [รูปแบบไฟล์และ Package](#8-รูปแบบไฟล์และ-package)
9. [Gap Analysis — มีแล้ว vs ต้องเพิ่ม/แก้](#9-gap-analysis--มีแล้ว-vs-ต้องเพิ่มแก้)
10. [Tool ใหม่ที่วางแผนไว้ (ยังไม่ implement)](#10-tool-ใหม่ที่วางแผนไว้-ยังไม่-implement)
11. [Prompt สำหรับ AI Agent (Copy ได้เลย)](#11-prompt-สำหรับ-ai-agent-copy-ได้เลย)

---

## 1) เป้าหมายและหลักการ

| หลัก | รายละเอียด |
|------|------------|
| **Real data only** | ค่าทุก widget มาจาก Engine API (`/api/tags/current`, `/api/trend`, `/api/alarms`) — ห้าม mock |
| **Editor = Runtime parity** | Live Preview, Monitor, Web Viewer ใช้ `@energylink/graphics-runtime` ร่วมกัน |
| **SLD + Scene** | รองรับ Single-Line Diagram และ Immersive Scene (2D+3D, Juddesk-style) |
| **Portable** | Export/Import `.graphic.json` + embedded assets |
| **Flexible properties** | ทุก object มี geometry, style, binding, logic, visibility |

### Vision ที่ lock แล้ว (Immersive Scene)

- **3D** — วาง GLB, orbit, คลิก zone → drill-down graphic ลูก
- **สายไฟ** — Wire 2D (port→port) + Cable 3D (Phase 12)
- **อุปกรณ์** — PNG ทั้งแผ่น + symbol แยกชิ้น
- **Asset** — รูป, 3D, Lottie, Video ใน Setup → Assets
- **Reference UX:** [Juddesk](https://www.juddesk.com/#editor) — chromeless scene, catalog drag, real scale

### ชั้นภาพ (Scene Layer)

| Layer | ประเภท object หลัก |
|-------|-------------------|
| L1 Background | floor plan PNG, rectangle, panel |
| L2 Scene 3D | viewport3d, building GLB |
| L3 Wiring | flowpath (wire 2D) |
| L4 Equipment | elecsymbol, image, sprite, lottie, hotspot |
| L5 Data Overlay | value, gauge, trend, badge, alarm |

### Render Mode

| `style.renderMode` | ใช้กับ | ผลลัพธ์ |
|--------------------|--------|---------|
| `scene` | image, 3d, symbol, sprite, lottie | ไม่มีกรอบ widget — เห็นแค่เนื้อหา |
| `wire` | flowpath | เส้น/ท่อเท่านั้น |
| `overlay` | value, badge, sparkline, text | โปร่งใส ไม่มีกรอบ |
| `panel` | chart, table, kpi, button | กรอบ dashboard ตามเดิม |

---

## 2) แผน Phase ทั้งหมด (Phase 1–14)

### Phase 1–2 — SLD Foundation ✅
- Flow Path, Elec Symbol, path edit, overload, trip animation
- Symbol types: breaker, disconnect, transformer, bus, meter, motor, CT, PT, generator, ATS

### Phase 3 — Editor UX ✅
- Live Preview, Layer panel, refresh interval, Ack alarm, Copy flow style

### Phase 4 — Effects Pilot ✅
- Diagram mode, Sprite, Lottie, 3D GLB viewport

### Phase 5 — Types & Package ✅
- Strong types (`shared-types`), `.graphic.json` export/import, layout history (local)

### Phase 6 — Tool Flexibility Core ✅
- Write-back (Button/Switch/Slider → `/api/tags/write`)
- Visibility/enable logic จาก tag
- Group/Container, resize handles, rotation, opacity
- KPI Card, Pie Chart

### Phase 7 — Data & Charts++ ✅
- Trend multi-tag + legend
- Tag Table columns + CSV export
- Formula Value, Status Badge
- Dynamic text `{name}`, `{value}`, `{unit}`

### Phase 8 — Scene Foundation ✅
- `renderMode`, `sceneLayer`, chromeless runtime
- Scene Catalog drag-to-canvas
- Isometric preview toggle
- Real-world scale (`realWidthMm`, `realHeightMm`, `sceneScaleMmPerPx`)
- Template "Blank Scene"

### Phase 9 — Asset Library ✅
- Setup → Assets (image, model3d, lottie, video)
- Asset picker ใน properties
- Bundle assets ใน `.graphic.json`
- Scene Catalog ลาก 3D models จาก library

### Phase 10 — Port & Wiring 2D ✅
- Ports บน image, elecsymbol, viewport3d, hotspot
- Wire Tool: port out → port in
- Auto-reroute เมื่อลาก object
- Validation port connection

### Phase 11 — 3D Scene & Drill-down *(next)*
- [ ] Object `scene3d` full-canvas
- [ ] Zone3d / RoomZone → `navigateTo`
- [ ] Runtime back stack, floor stack toggle
- [ ] Editor zone placement บน 3D preview

### Phase 12 — Wiring 3D & Dual Mode
- [ ] Object `cable3d`
- [ ] Port 3D บน model
- [ ] Toggle 2D SLD ↔ 3D Scene
- [ ] Sync wire 2D ↔ cable 3D (linked pair)

### Phase 13 — SLD Pro & Equipment
- [ ] Custom SVG symbol library
- [ ] Bus section + tap points
- [ ] Composite equipment (group + ports + symbols บนรูป)
- [ ] Cable/feeder label + live value
- [ ] Equipment tooltip + drill-down device

### Phase 14 — Platform & Operator
- [ ] Server-side layout history (Engine DB)
- [ ] Cross-project graphic library
- [ ] Kiosk mode, role guard, mobile viewer

---

## 3) Editor Tools (ไม่ใช่ object บน canvas)

| Tool | สถานะ | รายละเอียด |
|------|--------|-----------|
| **Select** | ✅ | เลือก/ลาก/resize object, ลูกศรเลื่อน (Shift=20px) |
| **Wire** | ✅ | คลิก port out → port in, Esc ยกเลิก, preview line |
| **Place tools** | ✅ | คลิก canvas วาง object จาก palette |
| **Grid snap** | ✅ | 20px, toggle ใน Canvas tab |
| **Drag & drop** | ✅ | Scene Catalog → canvas |
| **Path editor** | ✅ | flowpath: คลิกเพิ่มจุด, Enter จบ, Esc ยกเลิก |
| **Layer panel** | ✅ | visibility, z-order, group by scene layer |
| **Live Preview** | ✅ | ค่าจริงจาก Engine |
| **History** | ✅ | Local snapshots restore |
| **Isometric preview** | ✅ | Toggle มุมมอง isometric บน canvas |
| **Validate** | ✅ | ตรวจ binding, boundary, wire ports |
| **Export/Import** | ✅ | `.graphic.json` + assets bundle |
| **Templates** | ✅ | 7 templates (ดู §6) |
| **Save / Default** | ✅ | Persist ผ่าน Engine API |

### Property Tabs (Editor)

| Tab | เนื้อหา |
|-----|--------|
| **Canvas** | ชื่อ graphic, ขนาด, refresh ms, background, scene scale, background image |
| **Layers** | จัด layer, visibility |
| **Element** | properties ของ object ที่เลือก |
| **Live** | Live Preview |
| **History** | Snapshots |

---

## 4) Property Layers มาตรฐาน

ทุก canvas object ใช้โครงสร้างเดียวกัน:

### 4.1 Geometry (ทุก type)

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `id` | string | auto-generated |
| `name` | string | ชื่อ unique ใน graphic |
| `type` | GraphicObjectType | ประเภท |
| `x`, `y` | number | ตำแหน่ง px |
| `width`, `height` | number | ขนาด px (min 12) |
| `visible` | boolean | แสดง/ซ่อน |
| `locked` | boolean | ล็อกไม่ให้ลาก |
| `layer` | number | z-order |
| `text` | string? | ข้อความแสดง |

### 4.2 Scene Composition (ทุก type — Phase 8+)

| Field | Type | Default | คำอธิบาย |
|-------|------|---------|----------|
| `style.renderMode` | scene\|wire\|panel\|overlay | ตาม type | chromeless หรือ panel |
| `style.sceneLayer` | background\|scene\|wiring\|equipment\|overlay | ตาม type | ชั้นภาพ |
| `style.realWidthMm` | number? | — | ขนาดจริง mm |
| `style.realHeightMm` | number? | — | ขนาดจริง mm |
| `style.ports` | string? | ตาม type | `"in:0.08,0.5:In;out:0.92,0.5:Out"` |

### 4.3 Data Binding (ถ้าเกี่ยวกับ tag)

```ts
binding: {
  tagId?: string | null;       // ค่าหลัก / state / write
  tagIds?: string[];           // multi-tag (trend, bar, pie, formula)
  tagName?: string;            // display
  deviceId?: string;           // filter table
  flowTagId?: string | null;   // SLD flow (A, kW)
  enableTagId?: string | null; // breaker closed
  unit?: string;
  decimalPlaces?: number;
}
```

### 4.4 Style ร่วม (ทุก type ใน Style & Display)

| Field | Type | Default | คำอธิบาย |
|-------|------|---------|----------|
| `color` | string | `#142033` | สีข้อความ |
| `background` | string | `#ffffff` | พื้นหลัง |
| `stroke` | string | `#9fc4cc` | เส้นขอบ |
| `strokeWidth` | number | 1 | ความหนาขอบ |
| `fontSize` | number | 16 | ขนาดฟอนต์ |
| `opacity` | number | 1 | 0–1 |
| `rotation` | number | 0 | องศา -180..180 |
| `align` | string | center | จัดข้อความ |

### 4.5 Visibility Logic (ทุก type)

| Field | คำอธิบาย |
|-------|----------|
| `visibleWhenTag` | tag id สำหรับเงื่อนไข |
| `visibleWhenOp` | `>`, `<`, `>=`, `<=`, `==`, `!=` |
| `visibleWhenValue` | threshold |
| `blinkWhenAlarm` | กระพริบเมื่อ alarm บน tag ที่ bind |

### 4.6 Write Control (button, switch, slider)

| Field | Type | คำอธิบาย |
|-------|------|----------|
| `writeValue` | string | ค่าที่ button เขียน |
| `writeOnValue` / `writeOffValue` | string/number | switch ON/OFF |
| `step` | number | slider step |
| `enabledWhenTag` | string | tag เงื่อนไข enable |
| `enabledWhenOp` / `enabledWhenValue` | | เปรียบเทียบ |
| `confirmWrite` | boolean | ยืนยันก่อน write |

### 4.7 Display Mode (text vs image icon)

| Field | คำอธิบาย |
|-------|----------|
| `displayMode` | `text` \| `image` |
| `imageDataUrl` | URL/data URL รูป |
| `imageId` | id ใน asset library |

---

## 5) Canvas Object Types — รายละเอียดทุกตัว (34 types)

**Legend:** ✅ มีครบ · ⚠️ มีแต่ยังไม่ครบ · ❌ ยังไม่มี

### 5.1 Layout (8 types)

#### `text` — Text Label
| | |
|---|---|
| **Default size** | 180×40 |
| **Binding** | ไม่บังคับ (dynamic text ใช้ tag ถ้า bind) |
| **Render mode** | overlay |
| **Properties เฉพาะ** | Dynamic text: `{name}`, `{value}`, `{unit}` ใน `text` |
| **Validation** | — |
| **ต้องเพิ่ม/แก้** | ⚠️ Multi-line, align per-axis, link URL |

#### `image` — Image / Equipment Photo
| | |
|---|---|
| **Default size** | 180×100 |
| **Binding** | ไม่บังคับ |
| **Render mode** | scene |
| **Properties เฉพาะ** | `imageDataUrl`, `objectFit` (contain/cover/fill), `ports`, Asset picker |
| **Ports default** | `in:0.5,0.05:Feed;out:0.5,0.95:Load` |
| **ต้องเพิ่ม/แก้** | ⚠️ SVG inline, tint จาก tag, link URL |

#### `rectangle` — Rectangle
| | |
|---|---|
| **Default size** | 180×100 |
| **Properties เฉพาะ** | fill, stroke (ใช้ style ร่วม) |
| **ต้องเพิ่ม/แก้** | ❌ corner radius, gradient, shadow |

#### `line` — Line
| | |
|---|---|
| **Default size** | 220×20 |
| **ต้องเพิ่ม/แก้** | ❌ arrow head, dashed, angle |

#### `circle` — Circle
| | |
|---|---|
| **Default size** | 110×110 |
| **ต้องเพิ่ม/แก้** | ❌ ellipse, arc |

#### `polygon` — Polygon
| | |
|---|---|
| **Default size** | 140×120 |
| **ต้องเพิ่ม/แก้** | ❌ vertex editor แบบ flowpath |

#### `panel` — Panel Container
| | |
|---|---|
| **Default size** | 280×200 |
| **Render mode** | panel |
| **ต้องเพิ่ม/แก้** | ❌ title bar, collapsible, nested scroll |

#### `group` — Group Container
| | |
|---|---|
| **Default size** | 200×160 |
| **Properties เฉพาะ** | `memberIds` (comma-separated object ids), drag ย้ายพร้อม members |
| **Validation** | — |
| **ต้องเพิ่ม/แก้** | ⚠️ ungroup, nested group limit |

---

### 5.2 SLD / Bus (3 types)

#### `flowpath` — Flow Path / Wire 2D
| | |
|---|---|
| **Default size** | 280×48 |
| **Render mode** | wire |
| **Binding บังคับ** | `flowTagId` หรือ `tagId` |
| **Properties เฉพาะ** | |

| Field | Type | Default | คำอธิบาย |
|-------|------|---------|----------|
| `pathPoints` | string | auto | `"x1,y1;x2,y2"` local coords |
| `flowColor` | color | `#22d3ee` | สีเมื่อมีกระแส |
| `idleColor` | color | `#94a3b8` | สีเมื่อไม่มีกระแส |
| `flowThreshold` | number | 0.5 | ค่าขั้นต่ำถือว่า flow |
| `flowSpeed` | number | 1 | ความเร็ว animation |
| `strokeWidth` | number | 4 | ความหนาเส้น |
| `flowAlarmHigh` | number? | — | overload threshold |
| `alarmColor` | color | `#ef4444` | สี overload |
| `flowGlow` | boolean | true | เรืองแสง |
| `requireEnable` | boolean | false | ต้อง enable tag |
| `fromObjectId` | string? | — | port wire source object |
| `fromPortId` | string? | — | port wire source |
| `toObjectId` | string? | — | port wire dest object |
| `toPortId` | string? | — | port wire dest |

| **Editor** | Draw Path, Reset Line, Copy/Paste Style, Wire Tool |
| **Validation** | flow tag required; port endpoints ต้องครบถ้ามี |
| **ต้องเพิ่ม/แก้** | ❌ bidirectional flow, width scale ตามค่า tag, cable label |

#### `elecsymbol` — Electrical Symbol
| | |
|---|---|
| **Default size** | 80×80 |
| **Binding บังคับ** | `tagId` (state: 0=open, 1=closed, 2=trip) |
| **Ports default** | `in:0.08,0.5:In;out:0.92,0.5:Out` |
| **Properties เฉพาะ** | |

| Field | คำอธิบาย |
|-------|----------|
| `symbolId` | breaker, disconnect, transformer, bus, meter, motor, ct, pt, generator, ats |
| `states` | `"open,closed,trip"` comma-separated |

| **Runtime** | SVG symbol ตาม state, trip flash |
| **ต้องเพิ่ม/แก้** | ❌ rotation, label จาก tag, custom SVG library |

#### `hotspot` — Hotspot / Drill-down Zone
| | |
|---|---|
| **Default size** | 48×48 |
| **Binding บังคับ** | `tagId` |
| **Properties เฉพาะ** | `navigateTo` (graphic id), `hotspotAction` (tooltip/navigate), `ports` |
| **ต้องเพิ่ม/แก้** | ❌ popup panel, write command, polygon zone |

---

### 5.3 Values (8 types)

#### `value` — Numeric Value
| Binding | `tagId` บังคับ |
| Properties | `thresholdHigh`, `thresholdLow` (conditional color) |
| ต้องเพิ่ม | ⚠️ format string, prefix/suffix, quality badge |

#### `gauge` — Gauge
| Binding | `tagId` บังคับ |
| Properties | `min`, `max`, `thresholdHigh`, `thresholdLow` |
| ต้องเพิ่ม | ❌ radial variants, needle color, zones |

#### `led` — LED Indicator
| Binding | `tagId` บังคับ |
| Properties | `onColor`, `offColor` |
| ต้องเพิ่ม | ❌ blink on alarm, multi-color states |

#### `multistate` — Multi-State Display
| Binding | `tagId` บังคับ |
| Properties | `states` = `"Stopped,Running,Fault"` (ตามลำดับค่า 0,1,2…) |
| ต้องเพิ่ม | ❌ image per state |

#### `sparkline` — Sparkline Mini Chart
| Binding | `tagId` บังคับ |
| Properties | `period` (1h/24h/7d) |
| ต้องเพิ่ม | ❌ dual series, min/max marker |

#### `kpicard` — KPI Card ✅
| Binding | `tagId` บังคับ |
| Properties | `deltaTagId` (optional % change) |
| Default style | title, large value, delta |

#### `formulavalue` — Formula Value ✅
| Binding | `tagIds[]` บังคับ |
| Properties | `formula` (ใช้ A,B,C ตามลำดับ tag), `decimalPlaces`, `unit` |

#### `statusbadge` — Status Badge ✅
| Binding | `tagId` บังคับ |
| Properties | `badgeMap` = `"0:Stop:#94a3b8,1:Run:#22c55e,2:Fault:#ef4444"`, `alarmBadgeColor` |

---

### 5.4 Charts (3 types)

#### `trend` — Trend Chart ✅
| Binding | `tagIds[]` หรือ `tagId` |
| Properties | `period`, `showLegend`, multi-tag overlay |

#### `barchart` — Bar Chart
| Binding | `tagIds[]` บังคับ |
| ต้องเพิ่ม | ❌ stacked, horizontal, compare period |

#### `piechart` — Pie / Donut Chart ✅
| Binding | `tagIds[]` บังคับ |
| Properties | `donut` checkbox |

---

### 5.5 Tables (3 types)

#### `tagtable` — Tag Table ✅
| Binding | optional `deviceId` filter |
| Properties | `columns` (name,value,unit,quality,device), `maxRows`, `exportCsv` |

#### `alarmtable` — Alarm Table
| Properties | `maxRows`, `deviceId` filter |
| Runtime | Ack alarm |
| ต้องเพิ่ม | ❌ filter severity, sound highlight |

#### `alarm` — Single Alarm Display
| Binding | `tagId` บังคับ |
| ต้องเพิ่ม | ⚠️ รวมเข้า statusbadge/multistate |

---

### 5.6 Control (6 types)

#### `button` — Button ⚠️
| Binding | `tagId` (write) บังคับ |
| Properties | `writeValue`, write control + enable logic |
| Runtime | write ไป Engine |
| ต้องเพิ่ม | ❌ role guard, icon |

#### `switch` — Switch ⚠️
| Binding | `tagId` บังคับ |
| Properties | `writeOnValue`, `writeOffValue` |
| ต้องเพิ่ม | ❌ interlock tag |

#### `slider` — Slider ⚠️
| Binding | `tagId` บังคับ |
| Properties | `min`, `max`, `step` |
| ต้องเพิ่ม | ❌ live feedback label |

#### `levelbar` — Level Bar
| Binding | `tagId` บังคับ |
| Properties | `min`, `max` |
| ต้องเพิ่ม | ❌ vertical/horizontal toggle, gradient zones |

#### `navbutton` — Navigation Button
| Properties | `navigateTo` graphic id |
| ต้องเพิ่ม | ❌ icon, badge count |

#### `tabbar` — Tab Bar
| Properties | `tabs` = `"Label:graphicId,Label2:id2"` |
| ต้องเพิ่ม | ❌ active tab จาก tag, dynamic tabs |

---

### 5.7 Effects (3 types)

#### `sprite` — Sprite Sheet Animation
| Binding | optional tag (play threshold) |
| Properties | |

| Field | Default | คำอธิบาย |
|-------|---------|----------|
| `spriteUrl` | — | sheet PNG |
| `frameWidth` / `frameHeight` | 64 | ขนาด frame |
| `frameCount` | 8 | จำนวน frame |
| `columns` | 8 | คอลัมน์ใน sheet |
| `fps` | 12 | ความเร็ว |
| `playThreshold` | 0.5 | เล่นเมื่อ tag > threshold |

#### `lottie` — Lottie Animation
| Properties | `lottieUrl`, Asset picker, `loop`, `autoplay`, `playThreshold` |

#### `viewport3d` — 3D GLB Viewport
| Render mode | scene |
| Ports | equipment default |
| Properties | |

| Field | Default | คำอธิบาย |
|-------|---------|----------|
| `glbUrl` | — | GLB/GLTF URL หรือ data URL |
| `cameraPreset` | isometric | isometric / top / free |
| `exposure` | 1 | ความสว่าง |
| `autoRotate` | false | หมุนอัตโนมัติ |

| **ต้องเพิ่ม** | ❌ multiple GLB slots, tag-driven rotation, zone3d drill-down |

---

## 6) Scene Catalog & Asset Library

### Scene Catalog Presets (drag ลง canvas)

| Preset | Type | Real size (mm) |
|--------|------|----------------|
| 3D Building | viewport3d | 30000×20000 |
| MCC Cabinet | image | 800×2000 |
| Breaker | elecsymbol (breaker) | 100×200 |
| Transformer | elecsymbol (transformer) | 120×120 |
| Power Line | flowpath | 2000×40 |
| Motor | elecsymbol (motor) | 80×80 |

+ **Images** และ **3D Models** จาก Setup → Assets

### Templates (7)

| ID | Label | ขนาด |
|----|-------|------|
| blank-scene | Blank Scene | 1400×900 |
| blank | Blank Canvas | 1366×768 |
| single-meter | Single Meter | 900×… |
| floor | Floor Plan | … |
| mcc | MCC | … |
| feeder | Feeder | … |
| transformer | Transformer | … |

### Asset Library (Setup → Assets)

| Kind | Import ตรง | Storage |
|------|------------|---------|
| `image` | PNG, JPG, WebP, SVG, GIF | localStorage `energylink.setup.assets.v1` |
| `model3d` | GLB, GLTF | data URL |
| `lottie` | JSON | data URL |
| `video` | MP4, WebM | data URL |
| `sprite` | *(via image)* | — |

**Convert ที่ยังไม่มี:** FBX, OBJ, STL, DAE, 3DS → GLB (ต้อง Engine endpoint หรือ convert ภายนอก)

---

## 7) Port & Wiring Model

### Port String Format
```
id:x,y:label;id2:x2,y2:label2
```
ตัวอย่าง: `in:0.08,0.5:In;out:0.92,0.5:Out`

| Port id prefix | Kind |
|----------------|------|
| `in*` | input |
| `out*` | output |
| อื่นๆ | bidirectional |

### Default Ports

| Object type | Default |
|-------------|---------|
| elecsymbol | `DEFAULT_ELEC_PORTS` |
| image, viewport3d | `DEFAULT_EQUIPMENT_PORTS` |

### Wire Creation (Wire Tool)
1. เลือก Wire tool
2. คลิก port **out** (สีฟ้า)
3. คลิก port **in** (สีส้ม) บน object อื่น
4. สร้าง `flowpath` พร้อม `fromObjectId`, `fromPortId`, `toObjectId`, `toPortId`
5. ลาก object → สาย reroute อัตโนมัติ

### Wire Style (flowpath ทั้ง manual และ port-connected)
- Flow animation ตาม `flowTagId` + `flowThreshold`
- Enable gate จาก `enableTagId`
- Overload จาก `flowAlarmHigh`

---

## 8) รูปแบบไฟล์และ Package

### `.graphic.json` (GraphicExportPackage v1)

```json
{
  "packageVersion": 1,
  "exportedAt": "ISO8601",
  "source": { "projectId", "graphicId", "graphicName" },
  "assets": {
    "version": 1,
    "assets": [{ "id", "name", "kind", "url", "mimeType", "createdAt" }]
  },
  "graphic": {
    "name": "...",
    "width": 1400,
    "height": 900,
    "refreshIntervalMs": 1000,
    "layout": {
      "version": 1,
      "backgroundColor": "#e8eef2",
      "backgroundImage": null,
      "sceneScaleMmPerPx": 10,
      "objects": [ /* GraphicObjectDefinition[] */ ]
    }
  }
}
```

### GraphicLayout (v1)
- `objects[]` — ทุก canvas object
- `sceneScaleMmPerPx` — mm/px สำหรับ real-world scale (default 10)

### Persistence
- **Engine DB** — graphic metadata + layout JSON
- **localStorage** — asset library, layout history snapshots

---

## 9) Gap Analysis — มีแล้ว vs ต้องเพิ่ม/แก้

### ✅ ครบแล้ว (ใช้งานได้จริง)
- 34 object types บน canvas
- Real data binding + Live Preview
- Write-back controls
- Scene chromeless + catalog + isometric
- Asset library + export bundle
- Wire tool port→port
- KPI, Pie, Formula, Status Badge, multi-trend

### ⚠️ มีแต่ต้อง polish
| รายการ | สิ่งที่ขาด |
|--------|-----------|
| Button/Switch/Slider | role guard, interlock |
| Layout shapes | corner radius, arrow, dashed |
| Alarm table | severity filter, sound |
| Bar chart | stacked, horizontal |
| Text | multi-line, rich format |
| Group | ungroup UI |
| Image mode picker | ข้อความยังอ้าง "Setup → Images" บางจุด |

### ❌ ยังไม่ implement (Phase 11–14)
| รายการ | Phase |
|--------|-------|
| scene3d full canvas | 11 |
| Zone3d drill-down + back stack | 11 |
| cable3d + 3D ports | 12 |
| 2D ↔ 3D view toggle | 12 |
| Custom SVG symbol library | 13 |
| Bus section + composite equipment | 13 |
| Cable/feeder label on wire | 13 |
| FBX/OBJ convert pipeline | 9 (Engine) |
| Server layout history | 14 |
| Kiosk + role guard | 14 |

---

## 10) Tool ใหม่ที่วางแผนไว้ (ยังไม่ implement)

### Priority A — SCADA/EMS
Pipe/Duct, Iframe, Clock/DateTime, Video Stream placeholder

### Priority B — SLD/Building
Bus Section, Cable Label, Zone Overlay, Floor Plan Layer, Equipment Tooltip

### Priority C — Advanced
Map/Geo, Sankey, Gantt, Custom SVG upload

---

## 11) Prompt สำหรับ AI Agent (Copy ได้เลย)

### 11.1 Master Prompt — ภาพรวมทั้งโปรเจกต

```markdown
# EnergyL2 Graphics — Full Context Prompt

## Project
EnergyL2 SCADA/EMS มี Graphics Designer ใน `apps/editor-desktop` และ unified runtime ใน `packages/graphics-runtime`.
Monitor และ Web Viewer ใช้ `GraphicStage` + `RtObject` ร่วมกัน — ห้ามสร้าง runtime แยก.

## Data Rule (สำคัญ)
ค่าทุก widget มาจาก Engine API เท่านั้น:
- GET `/api/tags/current` — live values
- GET `/api/trend` — trend/sparkline
- GET `/api/alarms` — alarm table
- POST `/api/tags/write` — button/switch/slider write-back
ห้าม mock/fake data ใน runtime.

## Architecture
- Types: `packages/shared-types/src/graphics.ts`, `scene.ts`, `assets.ts`, `ports.ts`
- Runtime: `packages/graphics-runtime/src/RtObject.tsx`, `SldObjects.tsx`, `EffectObjects.tsx`, `charts.tsx`
- Editor: `apps/editor-desktop/src/features/graphics/GraphicsWorkspace.tsx`
- Assets: `graphicAssets.ts`, Setup → Assets panel
- Scene: `GraphicsSceneCatalog.tsx`, renderMode/sceneLayer chromeless

## Canvas Object Types (34)
layout: text, image, rectangle, line, circle, polygon, panel, group
sld: flowpath, elecsymbol, hotspot
values: value, gauge, led, multistate, sparkline, kpicard, formulavalue, statusbadge
charts: trend, barchart, piechart
tables: tagtable, alarmtable, alarm
control: button, switch, slider, levelbar, navbutton, tabbar
effects: sprite, lottie, viewport3d

## Property Layers (ทุก object)
1. Geometry: x,y,width,height,rotation,opacity,layer,visible,locked
2. Scene: renderMode, sceneLayer, realWidthMm, realHeightMm, ports
3. Binding: tagId, tagIds[], flowTagId, enableTagId, deviceId
4. Style: color, background, stroke, fontSize, thresholds
5. Logic: visibleWhenTag/Op/Value, enabledWhenTag, blinkWhenAlarm
6. Write: writeValue, writeOn/Off, confirmWrite (controls)
7. Type-specific: pathPoints, symbolId, formula, badgeMap, glbUrl, etc.

## Phase Status
✅ Phase 1–31 complete — SLD, charts, scene builder, unified frame (World/Diagram/HUD), editor shell refactor, layout v2

Unified viewport: one `.graphic.json`, camera presets (flat / top / orbit), Monitor + Web Viewer parity.

## Editor Tools
Select, Wire (port→port), Place, Grid snap 20px, Path editor, Layer panel,
Live Preview, History snapshots, Isometric preview, Validate, Export/Import .graphic.json

## Asset Formats
Images: PNG/JPG/WebP/SVG/GIF (direct)
3D: GLB/GLTF (direct); FBX/OBJ → convert externally for now
Anim: Lottie JSON, sprite sheet PNG
Video: MP4/WebM

## Wire Model
ports string: "in:0.08,0.5:In;out:0.92,0.5:Out"
flowpath stores: fromObjectId, fromPortId, toObjectId, toPortId + pathPoints
Wire tool: click out port → click in port → auto flowpath

## When adding/changing a tool
1. Add/update `GraphicObjectType` in shared-types
2. objectTools + toolCategories in GraphicsWorkspace
3. makeObject() defaults + applySceneDefaultsToStyle
4. validateGraphic() rules
5. RtObject render case
6. Editor properties panel section
7. Editor canvas placeholder + CSS
8. Template example if useful
9. Update GRAPHICS_ROADMAP.md + this reference doc

## Acceptance Criteria
- [ ] Place on canvas, bind tags, validate warns if missing
- [ ] Live Preview shows real Engine data
- [ ] Monitor/Web Viewer match Live Preview
- [ ] Save/reload preserves layout
- [ ] Export/import .graphic.json works
- [ ] vite build passes (editor-desktop)
- [ ] No mock runtime data

## Do NOT
- Duplicate runtime in web-viewer
- Over-engineer abstractions for single-tool changes
- Break backward compatibility of .graphic.json v1 without migration
```

### 11.2 Prompt — ทำ Phase ถัดไป

```markdown
# Task: EnergyL2 Graphics Phase [11|12|13|14]

อ่าน docs/GRAPHICS_TOOLS_COMPLETE_REFERENCE.md และ docs/GRAPHICS_TOOLS_MASTER_PLAN.md §5.2

## Phase [N] scope
[วาง scope จาก roadmap]

## Requirements
- Real Engine data only
- Editor + Runtime parity via @energylink/graphics-runtime
- normalizeLayoutForSave() on save
- Update docs when done

## Files typically touched
packages/shared-types/src/
packages/graphics-runtime/src/
apps/editor-desktop/src/features/graphics/
apps/editor-desktop/src/styles/editor.css

## Acceptance
[List concrete user-visible outcomes]
```

### 11.3 Prompt — เพิ่ม Tool ใหม่ 1 ตัว

```markdown
เพิ่ม graphic object type `[typeName]` ใน EnergyL2:

Palette: [layout|sld|values|charts|tables|control|effects]
Default: [W]×[H] px, renderMode: [scene|wire|panel|overlay]
Binding: [tagId | tagIds[] | flowTagId | none]
Runtime: [พฤติกรรมเมื่อมีค่า tag]
Properties เฉพาะ: [field list]
Validation: [rules]

ทำครบ 10 ขั้นใน GRAPHICS_TOOLS_MASTER_PLAN.md §6
อัปเดต GRAPHICS_TOOLS_COMPLETE_REFERENCE.md §5
```

### 11.4 Prompt — แก้ Tool เดิมให้ยืดหยุ่น

```markdown
ปรับปรุง tool `[typeName]` ใน EnergyL2 Graphics:

Properties ที่จะเพิ่ม:
- [field]: [type] — [behavior]

Runtime changes:
- [อธิบาย conditional style / animation]

Editor changes:
- Properties panel section ใน GraphicsWorkspace
- validateGraphic rule ถ้าจำเป็น

คง conventions: RtObject, applySceneDefaultsToStyle, chromeless rules
ทดสอบ: Live Preview + vite build
```

### 11.5 Prompt — Scene / Wiring / Asset

```markdown
# EnergyL2 Scene & Wiring Task

Context: Phase 8–10 done. Chromeless scene, asset library, wire 2D port→port.

Task: [เช่น "เพิ่ม zone3d drill-down" หรือ "FBX convert endpoint"]

Data models:
- ports: packages/shared-types/src/ports.ts
- assets: packages/shared-types/src/assets.ts
- scene: packages/shared-types/src/scene.ts

UX reference: Juddesk isometric scene — no widget chrome, drag catalog, real scale.

Must work in: Editor canvas, Live Preview, Monitor, Web Viewer export.
```

---

## Quick Reference — Object × Binding Matrix

| Type | tagId | tagIds | flowTag | enableTag | navigateTo | ports |
|------|:-----:|:------:|:-------:|:---------:|:----------:|:-----:|
| text | opt | — | — | — | — | — |
| image | opt | — | — | — | — | ✅ |
| value | **req** | — | — | — | — | — |
| gauge | **req** | — | — | — | — | — |
| trend | opt | **req** | — | — | — | — |
| flowpath | opt | — | **req** | opt | — | — |
| elecsymbol | **req** | — | — | — | — | ✅ |
| hotspot | **req** | — | — | — | opt | ✅ |
| kpicard | **req** | — | — | — | — | — |
| formulavalue | opt | **req** | — | — | — | — |
| statusbadge | **req** | — | — | — | — | — |
| piechart | — | **req** | — | — | — | — |
| barchart | — | **req** | — | — | — | — |
| button/switch/slider | **req** | — | — | — | — | — |
| navbutton | opt | — | — | — | **req** | — |
| viewport3d | opt | — | — | — | — | ✅ |
| tagtable/alarmtable | — | — | — | — | — | — |

**req** = validate แจ้งเตือนถ้าไม่ bind

---

*อัปเดตล่าสุด: Phase 10 complete — มิถุนายน 2026*
