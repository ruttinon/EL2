# HTML Graphic — Anchor Guide

หน้า **HTML + SCADA Overlay** ใช้จุดยึด (anchor) เพื่อให้ widget ตามตำแหน่งในอาคารเมื่อหมุน/ซูม scene 3D

## 1. จุดยึดแบบ DOM (ง่ายสุด)

ใส่ในไฟล์ HTML ของคุณ:

```html
<div
  data-el-anchor="roof-meter"
  data-el-label="มิเตอร์ดาดฟ้า"
  style="position:absolute;left:45%;top:30%"
></div>
```

EnergyLink SDK จะสแกน `[data-el-anchor]` และส่งตำแหน่งไปยัง Editor/Monitor อัตโนมัติ

## 2. Three.js — จุดติด mesh จริง

เมื่ออาคารเป็น Three.js ให้ผูก mesh กับ anchor:

```javascript
// หลังสร้าง scene, camera, mesh
EnergyLink.setThreeAnchor('chiller-roof', myMesh, camera, 'Chiller roof');
```

หรือใช้ projector เอง:

```javascript
EnergyLink.setAnchorProjector('meter-a', function () {
  const v = new THREE.Vector3();
  myMesh.getWorldPosition(v);
  v.project(camera);
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
});
```

## 3. ใน Graphics Editor

1. Import HTML → โหมด **Widgets**
2. จุดฟ้า = anchor ที่พบ · จุดเขียว = มี widget ผูกแล้ว
3. **คลิกจุดยึด** เพื่อผูก widget ที่เลือก หรือวางเครื่องมือแล้วคลิกจุด
4. Inspector → **HTML Anchor** เลือก/ปรับ offset
5. โหมด **3D View** → หมุน scene → widget ควรตามจุด

## 4. ผูก tag ใน HTML โดยตรง (แนวทาง A)

```html
<div id="meter-roof">-- kW</div>
<script>
  EnergyLink.subscribe('TAG_ID', function (v) {
    document.getElementById('meter-roof').textContent = v + ' kW';
  });
</script>
```

## 5. Runtime

- **Monitor** และ **Web Viewer** ใช้ `HtmlGraphicComposite` — widget ที่มี `style.anchorId` จะ resolve ตำแหน่งจาก iframe ทุกเฟรม
- ฟิลด์ใน widget: `anchorId`, `anchorOffsetX`, `anchorOffsetY`

## 6. ปักจุดใน Editor (Phase 2)

1. กด **3D View** แล้วกด **ปักจุด**
2. คลิกบนอาคารใน HTML (Three.js จะ raycast อัตโนมัติถ้ามี `window.scene` + `window.camera`)
3. จุดใหม่บันทึกใน `layout.externalPage.pickedAnchors` เมื่อ Save
4. สลับ **Widgets** เพื่อวาง widget หรือเลือก widget แล้วคลิกจุด

สำหรับ Three.js แนะนำให้ลงทะเบียน scene:

```javascript
EnergyLink.registerThreeScene(scene, camera, renderer.domElement);
```

## API สรุป (ใน iframe)

| ฟังก์ชัน | คำอธิบาย |
|---------|----------|
| `EnergyLink.setAnchor(id, x, y, label?)` | ตำแหน่งคงที่ (พิกเซล) |
| `EnergyLink.setThreeAnchor(id, mesh, camera, label?)` | ติด Three.js Object3D |
| `EnergyLink.setAnchorProjector(id, fn)` | คืน `{ x, y }` เอง |
| `EnergyLink.registerThreeScene(scene, camera, canvas)` | เปิด raycast pick บน Three.js |
| `EnergyLink.setWorldAnchor(id, x, y, z, camera, label?)` | จุด 3D world ที่ตามกล้อง |
| `EnergyLink.refreshAnchors()` | บังคับอัปเดตทันที |
