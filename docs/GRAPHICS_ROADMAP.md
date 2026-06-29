# Graphics Roadmap

## Completed

- [x] Data widgets (Trend, Table, Sparkline, Bar, Alarm Table)
- [x] Unified runtime (`@energylink/graphics-runtime`)
- [x] Templates (Single Meter, Floor, MCC, Feeder, Transformer)
- [x] SLD Phase 1–2: Flow Path, Elec Symbol, path edit, overload, trip
- [x] Phase 3: Live Preview, Layer panel, refresh interval, Ack alarm, Copy flow style
- [x] Phase 4: Diagram mode, Sprite, Lottie, 3D GLB pilot
- [x] Phase 5: Strong types, `.graphic.json` package, layout history
- [x] Phase 6: Write-back controls, visibility logic, Group, resize handles, rotation/opacity, KPI Card, Pie Chart, dynamic text
- [x] Phase 7: Trend multi-tag overlay + legend, Tag Table columns + CSV, Formula Value, Status Badge
- [x] Phase 8: Scene Foundation — renderMode, chromeless, Scene Catalog drag, isometric preview, real-world scale, layer groups
- [x] Phase 9: Asset Library — Setup → Assets, GLB/GLTF/Lottie/Video import, asset picker, bundle in `.graphic.json`
- [x] Phase 10: Port & Wiring 2D — ports on equipment, Wire tool port→port, auto-reroute on drag, flow path validation
- [x] Phase 11: 3D Drill-down — `zone3d` room zones, navigateTo + back stack, floor level filter
- [x] Phase 12: Wiring 3D & Dual View — `cable3d` paths, Wire/Cable tools, 2D/3D/Dual toggle, sync from linked wire
- [x] Phase 13: SLD Pro & Equipment — custom SVG symbols, bus section, feed label, zone2d, door/lamp, composite group, equipment tooltip/drill-down
- [x] Phase 14: Platform & Operator — server layout history (Engine DB), role write guard, kiosk mode (Web Viewer), mobile/kiosk CSS
- [x] Phase 15: Modular Scene Builder — Wall draw, Room fill (4 corners), 3D snap grid, equipment catalog kit, runtime chromeless, live status bar
- [x] Phase 16: Platform polish — GLB auto ports, video stream types (file/MJPEG/HLS URL), cable3d flow particles, PWA manifest (Web Viewer), portable `.graphic.json` assets
- [x] Phase 17: Scene Builder Pro — wall chain, room polygon (3+ corners), detect room from wall loop, snap wire to port, snap equipment to wall, measure tool, ungroup UX
- [x] Phase 18: 3D Deep — glTF port names, Cable3d WebGL, zone3d extrude, editor floor filter, Juddesk camera
- [x] Phase 19: SCADA widgets — Clock, Pipe path + flow, Formula validation UI, interlock, alarm severity + sound
- [x] Phase 20: UX shell — Electron window controls, sidebar toggle, canvas zoom, Publish vs Default, RTSP doc, FBX staging API
- [x] Phase 21: Platform finish — shared asset server, operator role UI, 3D zone paint, flowpath WebGL, stream tools API, fbx2gltf auto-convert
- [x] Phase 22: Optional finish — Engine RTSP→MJPEG proxy, `scene3d` full canvas, viewport GLB cable inlay, Video RTSP stream type
- [x] Phase 23: Unified frame — one viewport, camera presets (flat/top/orbit), `@energylink/unified-viewport`, layout v2, Monitor/Web/Live parity
- [x] Phase 24: Editor runtime parity — DiagramLayer, GraphicEditorDiagram, live tags, HUD split, layer panel
- [x] Phase 25: Layer model — World/Diagram/HUD groups, unifiedLayer picker, EditorCanvasOverlays
- [x] Phase 26: Shell refactor — `GraphicEditorToolbar`, `GraphicPropertiesSidebar`, `GraphicCanvasPropertiesPanel`; remove `R3fCanvasLayer`
- [x] Phase 27: Engine normalize — `normalizeGraphicLayout` in shared-types; GET `/api/graphics` returns v2 layout
- [x] Phase 28: Polish — `GraphicElementPropertiesPanel`, deprecate `GraphicViewModeBar`, history restore normalizes v2
- [x] Phase 29: History & cleanup — remove `GraphicViewModeBar`, Engine history API in editor, DELETE revision
- [x] Phase 30: Legacy scene view — migrate `sceneViewMode` → `defaultCamera`, slim `GraphicStage` filter
- [x] Phase 31: Final cleanup — remove `sceneViewMode` from layout type, canvas zoom persist per graphic
- [x] Phase 32: Post-unified polish — Thai UI encoding fix, `GraphicLayout` re-export in Monitor/Web, docs sync
- [x] Phase 33: GLB 3D cable inlay + Engine HLS segment proxy
- [x] Phase 34: ElectriSim UX — bottom catalog strip, Build/SCADA mode, debug layers, auto route
- [x] Phase 35: Door/Window wall snap, Logic Flow view, 3D floating HUD widgets
- [x] Phase 36: SCADA Dashboard view, room prefabs (Office/MCC/Lab/Warehouse)
- [x] Phase 37: UX revamp — simplified toolbar, fix placement bugs, armed banner

**Unified frame roadmap (Phases 23–31) complete.**

---

## Vision (locked)

**2D + 3D ครบทุกอย่าง** — ดู [GRAPHICS_TOOLS_MASTER_PLAN.md §5.1](./GRAPHICS_TOOLS_MASTER_PLAN.md)

---

## Future (optional / external deps)

- [x] Particle cable **inside** GLB mesh geometry (true 3D path follow) — `ThreeViewportCable` in WorldLayer
- [x] HLS segment proxy in Engine — `GET /api/stream/rtsp/:id/hls/*` alongside MJPEG bridge

**Kiosk:** Web Viewer `?kiosk=1` · Monitor `?kiosk=1`

**Shared assets:** `GET/POST /api/assets/shared` · Editor **Setup → Assets → Sync from Engine**

See also [GRAPHICS_SLD_GUIDE.md](./GRAPHICS_SLD_GUIDE.md), [VIDEO_STREAM_RTSP.md](./VIDEO_STREAM_RTSP.md), [ASSET_CONVERT_PIPELINE.md](./ASSET_CONVERT_PIPELINE.md).

---

## Phase 21 — Platform Finish ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 21.1 | Shared asset library API | ✅ `/api/assets/shared` |
| 21.2 | Editor sync from Engine | ✅ Setup → Assets |
| 21.3 | Operator role picker | ✅ Monitor + Web Viewer |
| 21.4 | Flowpath WebGL (isometric) | ✅ R3f `ThreeCable` + tag bind |
| 21.5 | Zone paint on 3D floor | ✅ Isometric + zone3d tool |
| 21.6 | Stream tools + RTSP hint | ✅ `/api/stream/tools` |
| 21.7 | FBX auto-convert | ✅ fbx2gltf on PATH → shared GLB |

---

## Phase 22 — Optional Finish ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 22.1 | RTSP→MJPEG proxy | ✅ `POST /api/stream/rtsp/start` + `GET …/mjpg` |
| 22.2 | Video RTSP stream type | ✅ Editor + runtime auto-bridge |
| 22.3 | `scene3d` full canvas | ✅ Effects → Full 3D |
| 22.4 | Viewport cable inlay | ✅ Particles inside GLB viewport |

---

## Phase 23 — Unified Frame ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 23.1 | Layout v2 + `defaultCamera` | ✅ `GRAPHIC_LAYOUT_VERSION_V2` |
| 23.2 | `@energylink/unified-viewport` | ✅ World + diagram layers |
| 23.3 | Editor single viewport | ✅ `UnifiedViewport` + `CameraToolbar` |
| 23.4 | Monitor + Web Viewer parity | ✅ `RuntimeGraphicViewport` |
| 23.5 | Live Preview parity | ✅ Modal + unified runtime |
| 23.6 | GLB + Spline in WorldLayer | ✅ R3F `useGLTF` + Spline |

---

## Phase 24 — Editor Runtime Parity ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 24.1 | `DiagramLayer` (GraphicStage wrapper) | ✅ |
| 24.2 | `GraphicEditorDiagram` + hit overlay | ✅ |
| 24.3 | Editor loads live tags for diagram preview | ✅ |
| 24.4 | HUD layer split + layer panel groups | ✅ |
| 24.5 | `GraphicEditorCanvas` shell extract | ✅ |
| 24.6 | Properties `unifiedLayer` override | ✅ |

---

## Phase 25 — Layer Model ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 25.1 | HUD tier runtime + editor | ✅ |
| 25.2 | Layer panel World/Diagram/HUD | ✅ |
| 25.3 | `EditorCanvasOverlays` module | ✅ |

---

## Phase 26 — Shell Refactor ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 26.1 | `GraphicEditorToolbar` (File/Camera/Zoom/More) | ✅ |
| 26.2 | `GraphicPropertiesSidebar` + `GraphicCanvasPropertiesPanel` | ✅ |
| 26.3 | Wire sidebar/toolbar into `GraphicsWorkspace` | ✅ |
| 26.4 | Remove deprecated `R3fCanvasLayer` | ✅ |

---

## Phase 27 — Engine Normalize ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 27.1 | `normalizeGraphicLayout` → `@energylink/shared-types` | ✅ |
| 27.2 | Engine GET graphics normalizes layout v2 | ✅ |
| 27.3 | Deprecate `layout.sceneViewMode` | ✅ |

---

## Phase 28 — Polish ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 28.1 | Extract `GraphicElementPropertiesPanel` + `elementPanelTypes` | ✅ |
| 28.2 | Deprecate `GraphicViewModeBar` (unified camera replaces 2D/3D/Dual) | ✅ |
| 28.3 | History restore normalizes layout v2 | ✅ |

---

## Phase 29 — History & Cleanup ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 29.1 | Remove `GraphicViewModeBar` export + file | ✅ |
| 29.2 | Editor history via `window.energylink.graphics.*History` | ✅ |
| 29.3 | `DELETE /api/graphics/:id/history/:revisionId` | ✅ |

---

## Phase 30 — Legacy Scene View ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 30.1 | `legacySceneViewModeToDefaultCamera` + strip on normalize | ✅ |
| 30.2 | Remove `sceneViewMode` from `GraphicStage` (pre-filtered objects) | ✅ |
| 30.3 | Deprecate `filterObjectsBySceneView` in graphics-runtime | ✅ |

---

## Phase 31 — Final Cleanup ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 31.1 | Remove `sceneViewMode` from `GraphicLayout` type | ✅ |
| 31.2 | Editor canvas zoom persist per graphic (localStorage) | ✅ |
| 31.3 | Delete `sceneView.ts` from graphics-runtime | ✅ |

---

## Phase 32 — Post-Unified Polish ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 32.1 | Fix Thai / arrow encoding in `GraphicElementPropertiesPanel` | ✅ |
| 32.2 | Monitor + Web Viewer re-export `GraphicLayout` from shared-types | ✅ |
| 32.3 | Sync `GRAPHICS_TOOLS_COMPLETE_REFERENCE` phase status | ✅ |

---

## Phase 33 — Platform Streams & 3D Cables ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 33.1 | `ThreeViewportCable` — particle cable inside GLB/box viewport (WorldLayer) | ✅ |
| 33.2 | `viewportCables.ts` shared module (flat SVG + 3D path) | ✅ |
| 33.3 | Engine HLS segment proxy `GET /api/stream/rtsp/:id/hls/*` | ✅ |
| 33.4 | RTSP bridge prefers HLS; `HlsVideoPlayer` for `.m3u8` widgets | ✅ |

---

## Phase 34 — ElectriSim UX Shell ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 34.1 | Bottom `GraphicSceneCatalogStrip` (Build/Assets/Routing/SCADA) | ✅ |
| 34.2 | Click-to-place catalog + drag parity | ✅ |
| 34.3 | Build / SCADA workspace mode on toolbar | ✅ |
| 34.4 | Viewport debug toggles (walls, cables, labels, widgets, flow) | ✅ |
| 34.5 | Auto Route equipment (wire + cable3d chain) | ✅ |

---

## Phase 35 — Openings, Logic Flow & HUD ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 35.1 | Door / Window tools — snap to wall via `snapPointToWall` | ✅ |
| 35.2 | Build catalog strip + scene palette door/window entries | ✅ |
| 35.3 | Logic Flow overlay (equipment nodes + wire/cable edges) | ✅ |
| 35.4 | Floating HUD widgets on bound equipment in 3D camera | ✅ |

---

## Phase 36 — SCADA Dashboard & Room Prefabs ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 36.1 | SCADA Dashboard full-screen overlay (`EditorScadaDashboardView`) | ✅ |
| 36.2 | SCADA mode auto-opens dashboard; toolbar Dashboard toggle | ✅ |
| 36.3 | Room prefabs — Office, MCC, Lab, Warehouse (one-click place) | ✅ |
| 36.4 | Build catalog strip prefab cards + wall/floor/zone3d bundle | ✅ |

---

## Phase 37 — UX Revamp ✅

| # | งาน | สถานะ |
|---|-----|--------|
| 37.1 | Toolbar 1 แถว: แก้ไข / ดูตัวอย่าง / Logic + เมนูเพิ่มเติม | ✅ |
| 37.2 | แก้ placement: door/window snap, 3D armed, zoom drop, Esc ยกเลิก | ✅ |
| 37.3 | Armed banner ชัดเจน + catalog คลิกซ้ำปิด | ✅ |
| 37.4 | ลบ catalog ซ้ำซ้าย — ใช้แถบล่างอย่างเดียว | ✅ |
