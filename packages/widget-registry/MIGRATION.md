# Widget Registry — Migration Plan

## สรุป ✅

**Registry รวม 45 widgets** — runtime รองรับครบ · **palette แสดง 37 widgets** (เน้น HMI/SCADA 2D)

### แนวทางผลิตภัณฑ์ (อัปเดต)

- **3D / สร้างอาคาร** — ไม่แสดงใน palette แล้ว (wall, zone3d, viewport3d, scene3d, pipe, cable3d, sprite, lottie)
- **โมเดล 3D** — ใช้ **Import HTML** แล้วเรียกไฟล์โมเดลจากหน้า HTML ไม่ได้สร้างฉาก 3D ใน editor
- **Palette หลัก** — เลย์เอาต์ · ค่า/สถานะ · กราฟ · ตาราง · ควบคุม · นำทาง (+ ไฟฟ้า/SLD ในแท็บ SLD)

| หมวด palette | จำนวน | รายการหลัก |
|-------------|--------|------------|
| เลย์เอาต์ | 8 | text, rectangle, circle, polygon, line, image, panel, group |
| ค่า/สถานะ | 10 | value, gauge, progressbar, levelbar, kpicard, multistate, semaphore, status, clock, formulavalue |
| กราฟ | 2 | echart, trend |
| ตาราง | 2 | tagtable, alarmtable |
| ไฟฟ้า / SLD | 6 | elecsymbol, flowpath, bussection, feedlabel, zone2d, hotspot |
| สื่อ | 3 | video, iframe (+ image ซ้ำใน layout) |
| ควบคุม | 5 | button, switch, slider, inputfield, dropdown |
| นำทาง | 2 | navbutton, tabbar |

### ซ่อนจาก palette (runtime ยังเปิดไฟล์เก่าได้)

`wall`, `zone3d`, `viewport3d`, `scene3d`, `pipe`, `cable3d`, `sprite`, `lottie`

## ทดสอบ

```powershell
pnpm --filter @energylink/widget-registry test
pnpm exec tsc --noEmit -p apps/editor-desktop
pnpm dev:editor
```

## API

```ts
import { listPaletteWidgets, listRegistryWidgets } from '@energylink/widget-registry';
// palette = editor UI only
// registry = full set including legacy 3D types
```

## ยังไม่อยู่ใน registry (deprecated / alias เท่านั้น)

`led`, `statusbadge`, `sparkline`, `barchart`, `piechart`, `alarm`, `ellipse` — รองรับ runtime แต่ไม่มีใน palette (ใช้ widget ใหม่แทน)
