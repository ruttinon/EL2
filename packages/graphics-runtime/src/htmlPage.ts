import type { GraphicLayout } from '@energylink/shared-types';
export { isHtmlGraphicPage, isCanvasGraphicPage } from '@energylink/shared-types';

const ASSET_REF_PREFIX = 'asset://';

function decodeDataUrlText(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return '';
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  try {
    if (meta.includes(';base64')) return atob(payload);
    return decodeURIComponent(payload);
  } catch {
    return '';
  }
}

export function resolveExternalPageHtml(
  layout: GraphicLayout,
  resolveRef?: (ref: string) => string,
): string {
  const ep = layout.externalPage;
  if (!ep) return defaultHtmlPlaceholder();
  if (ep.htmlContent?.trim()) return ep.htmlContent;
  if (ep.htmlRef && resolveRef) {
    const raw = resolveRef(ep.htmlRef);
    if (raw) return decodeDataUrlText(raw);
  }
  if (ep.url?.trim()) return '';
  return defaultHtmlPlaceholder();
}

export function externalPageUsesUrl(layout: GraphicLayout): boolean {
  return Boolean(layout.externalPage?.url?.trim().startsWith('http'));
}

export function defaultHtmlPlaceholder(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EnergyLink HTML Page</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;font-family:system-ui;background:#0f172a;color:#e2e8f0}
  .demo-scene{position:relative;width:100%;height:100%;background:linear-gradient(180deg,#1e3a5f 0%,#0f172a 55%,#14532d 100%)}
  .demo-building{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:220px;height:280px;background:linear-gradient(135deg,#64748b,#334155);border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
  .demo-roof{position:absolute;left:50%;top:28%;transform:translate(-50%,-50%);width:260px;height:40px;background:#475569;border-radius:4px}
  [data-el-anchor]{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#22d3ee;box-shadow:0 0 0 3px rgba(34,211,238,.35);pointer-events:none}
</style></head><body>
<div class="demo-scene">
  <div class="demo-roof"></div>
  <div class="demo-building"></div>
  <div data-el-anchor="roof-meter" data-el-label="Roof meter" style="left:50%;top:26%"></div>
  <div data-el-anchor="facade-main" data-el-label="Facade" style="left:50%;top:48%"></div>
  <div data-el-anchor="ground-entry" data-el-label="Entry" style="left:50%;top:72%"></div>
</div>
<script>
  // Three.js buildings: EnergyLink.setAnchorProjector('id', function(){ return {x,y}; });
</script>
</body></html>`;
}

/** Inject EnergyLink SDK before </head> or after <body> */
export function injectEnergyLinkSdk(html: string): string {
  const script = `<script>${ENERGYLINK_SDK_SCRIPT}</script>`;
  if (html.includes('</head>')) return html.replace('</head>', `${script}</head>`);
  if (/<body[\s>]/i.test(html)) return html.replace(/<body([^>]*)>/i, `<body$1>${script}`);
  return `${script}${html}`;
}

export const ENERGYLINK_SDK_SCRIPT = `(function(){
  var subs = Object.create(null);
  var cache = Object.create(null);
  var pending = Object.create(null);
  var manualAnchors = Object.create(null);
  var anchorProjectors = Object.create(null);
  var anchorLoopOn = false;
  var pickMode = false;
  var pickCounter = 0;
  var threePick = null;

  function getAutoCamera() {
    if (threePick && threePick.camera) return threePick.camera;
    return window.camera || window.__camera || null;
  }

  function getAnchorCanvas() {
    if (threePick && threePick.domElement) return threePick.domElement;
    if (window.renderer && window.renderer.domElement) return window.renderer.domElement;
    return document.querySelector('canvas');
  }

  function tryAutoRegisterScene() {
    if (threePick) return;
    var scene = window.scene || window.__scene || null;
    var camera = window.camera || window.__camera || null;
    var canvas = getAnchorCanvas();
    if (scene && camera && canvas) {
      threePick = { scene: scene, camera: camera, domElement: canvas };
    }
  }

  function projectToDoc(camera, vec3) {
    var THREE = window.THREE;
    var c = camera || getAutoCamera();
    var canvas = getAnchorCanvas();
    if (!THREE || !c || !vec3) return null;
    var v = vec3.clone ? vec3.clone() : new THREE.Vector3(vec3.x, vec3.y, vec3.z);
    v.project(c);
    var rect = canvas ? canvas.getBoundingClientRect() : null;
    if (rect && rect.width > 0 && rect.height > 0) {
      return {
        x: rect.left + (v.x * 0.5 + 0.5) * rect.width + (window.scrollX || 0),
        y: rect.top + (-v.y * 0.5 + 0.5) * rect.height + (window.scrollY || 0)
      };
    }
    var w = window.innerWidth || document.documentElement.clientWidth || 1;
    var h = window.innerHeight || document.documentElement.clientHeight || 1;
    return {
      x: (v.x * 0.5 + 0.5) * w + (window.scrollX || 0),
      y: (-v.y * 0.5 + 0.5) * h + (window.scrollY || 0)
    };
  }

  function isSkippablePickHit(hit) {
    if (!hit || !hit.object) return true;
    var obj = hit.object;
    if (obj.userData && obj.userData.elAnchorPick) return false;
    if (obj.userData && obj.userData.elSkipAnchorPick) return true;
    var n = (obj.name || '').toLowerCase();
    if (/ground|floor|terrain|grass|lawn|parking|road|driveway|sidewalk|landscape|water|plane/.test(n)) return true;
    return false;
  }

  function bestPickHit(hits) {
    if (!hits || !hits.length) return null;
    for (var i = 0; i < hits.length; i++) {
      if (!isSkippablePickHit(hits[i])) return hits[i];
    }
    return hits[0];
  }

  function restorePickedAnchors(list) {
    if (!list || !list.length) return;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a || !a.id) continue;
      if (typeof a.worldX === 'number' && typeof a.worldY === 'number' && typeof a.worldZ === 'number') {
        var lbl = a.label || a.id;
        var world = { x: a.worldX, y: a.worldY, z: a.worldZ };
        anchorProjectors[a.id] = function() {
          var pt = projectToDoc(getAutoCamera(), world);
          if (!pt) return null;
          return { x: pt.x, y: pt.y, label: lbl };
        };
      } else if (typeof a.x === 'number' && typeof a.y === 'number') {
        manualAnchors[a.id] = { id: a.id, x: a.x, y: a.y, label: a.label || a.id };
      }
    }
    broadcastAnchors();
  }

  function pickAtScreen(clientX, clientY) {
    tryAutoRegisterScene();
    var THREE = window.THREE;
    var scene = threePick ? threePick.scene : (window.scene || window.__scene || null);
    var camera = threePick ? threePick.camera : (window.camera || window.__camera || null);
    var canvas = getAnchorCanvas();

    var x = clientX + (window.scrollX || 0);
    var y = clientY + (window.scrollY || 0);
    var world = null;

    if (THREE && scene && camera && canvas) {
      try {
        var rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
          var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
          var raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
          var hits = raycaster.intersectObjects(scene.children, true);
          var hit = bestPickHit(hits);
          if (hit && hit.point) {
            var pt = hit.point;
            world = { x: pt.x, y: pt.y, z: pt.z };
            var docPt = projectToDoc(camera, pt);
            if (docPt) { x = docPt.x; y = docPt.y; }
          }
        }
      } catch (err) { /* ignore raycast */ }
    }

    pickCounter += 1;
    var id = 'pick-' + pickCounter;
    var label = 'Pick ' + pickCounter;

    if (world && camera) {
      EnergyLink.setWorldAnchor(id, world.x, world.y, world.z, camera, label);
    } else {
      EnergyLink.setAnchor(id, x, y, label);
    }

    broadcastAnchors();
    post({
      type: 'EL_ANCHOR_PICKED',
      anchor: {
        id: id,
        x: x,
        y: y,
        label: label,
        worldX: world ? world.x : undefined,
        worldY: world ? world.y : undefined,
        worldZ: world ? world.z : undefined
      }
    });
  }

  function onPickClick(e) {
    if (!pickMode) return;
    e.preventDefault();
    e.stopPropagation();
    pickAtScreen(e.clientX, e.clientY);
  }

  document.addEventListener('click', onPickClick, true);

  function post(msg) {
    try { parent.postMessage(msg, '*'); } catch (err) { /* sandbox */ }
  }

  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'EL_TAG_UPDATE' && d.tagId) {
      cache[d.tagId] = d;
      var list = subs[d.tagId] || [];
      for (var i = 0; i < list.length; i++) list[i](d.value, d);
    }
    if (d.type === 'EL_READ_RESULT' && d.requestId && pending[d.requestId]) {
      pending[d.requestId](d.value);
      delete pending[d.requestId];
    }
    if (d.type === 'EL_REQUEST_ANCHORS') {
      broadcastAnchors();
    }
    if (d.type === 'EL_PICK_MODE') {
      pickMode = !!d.enabled;
      document.body.style.cursor = pickMode ? 'crosshair' : '';
      return;
    }
    if (d.type === 'EL_RESTORE_PICKED_ANCHORS' && d.anchors) {
      restorePickedAnchors(d.anchors);
      return;
    }
  });

  function scanDomAnchors() {
    var out = [];
    var els = document.querySelectorAll('[data-el-anchor]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var id = el.getAttribute('data-el-anchor');
      if (!id) continue;
      var r = el.getBoundingClientRect();
      out.push({
        id: id,
        x: r.left + r.width / 2 + (window.scrollX || 0),
        y: r.top + r.height / 2 + (window.scrollY || 0),
        label: el.getAttribute('data-el-label') || el.getAttribute('title') || id
      });
    }
    return out;
  }

  function collectAnchors() {
    var map = Object.create(null);
    var dom = scanDomAnchors();
    for (var i = 0; i < dom.length; i++) map[dom[i].id] = dom[i];
    for (var k in manualAnchors) {
      if (manualAnchors[k]) map[k] = manualAnchors[k];
    }
    for (var pid in anchorProjectors) {
      try {
        var p = anchorProjectors[pid]();
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
          map[pid] = { id: pid, x: p.x, y: p.y, label: map[pid] && map[pid].label || pid };
        }
      } catch (err) { /* ignore projector errors */ }
    }
    return map;
  }

  function broadcastAnchors() {
    var map = collectAnchors();
    var list = [];
    for (var k in map) list.push(map[k]);
    post({ type: 'EL_ANCHORS', anchors: list });
  }

  function anchorTick() {
    if (!anchorLoopOn) return;
    tryAutoRegisterScene();
    broadcastAnchors();
    requestAnimationFrame(anchorTick);
  }

  window.EnergyLink = {
    readTag: function(tagId) {
      if (cache[tagId]) return Promise.resolve(cache[tagId].value);
      return new Promise(function(resolve) {
        var requestId = 'r_' + Math.random().toString(36).slice(2);
        pending[requestId] = resolve;
        post({ type: 'EL_READ', tagId: tagId, requestId: requestId });
      });
    },
    subscribe: function(tagId, cb) {
      if (!subs[tagId]) subs[tagId] = [];
      subs[tagId].push(cb);
      if (cache[tagId]) cb(cache[tagId].value, cache[tagId]);
      return function() {
        subs[tagId] = (subs[tagId] || []).filter(function(f) { return f !== cb; });
      };
    },
    write: function(tagId, value) {
      post({ type: 'EL_WRITE', tagId: tagId, value: value });
      return Promise.resolve();
    },
    setAnchor: function(id, x, y, label) {
      manualAnchors[id] = { id: id, x: Number(x), y: Number(y), label: label || id };
    },
    removeAnchor: function(id) {
      delete manualAnchors[id];
      delete anchorProjectors[id];
    },
    setAnchorProjector: function(id, fn) {
      if (typeof fn === 'function') anchorProjectors[id] = fn;
      else delete anchorProjectors[id];
    },
    /** Bind a Three.js Object3D — projects world position each frame (requires window.THREE). */
    setThreeAnchor: function(id, object3d, camera, label) {
      if (!id || !object3d) { delete anchorProjectors[id]; return; }
      var lbl = label || id;
      var obj = object3d;
      anchorProjectors[id] = function() {
        var THREE = window.THREE;
        var c = getAutoCamera() || camera;
        if (!THREE || !obj || !c) return null;
        var v = new THREE.Vector3();
        obj.getWorldPosition(v);
        var pt = projectToDoc(c, v);
        if (!pt) return null;
        return { x: pt.x, y: pt.y, label: lbl };
      };
    },
    setWorldAnchor: function(id, wx, wy, wz, camera, label) {
      if (!id) return;
      var lbl = label || id;
      var world = { x: Number(wx), y: Number(wy), z: Number(wz) };
      anchorProjectors[id] = function() {
        var pt = projectToDoc(getAutoCamera() || camera, world);
        if (!pt) return null;
        return { x: pt.x, y: pt.y, label: lbl };
      };
    },
    registerThreeScene: function(scene, camera, domElement) {
      threePick = { scene: scene, camera: camera, domElement: domElement || document.querySelector('canvas') };
    },
    refreshAnchors: broadcastAnchors,
    startAnchorTracking: function() {
      if (anchorLoopOn) return;
      anchorLoopOn = true;
      anchorTick();
    },
    stopAnchorTracking: function() {
      anchorLoopOn = false;
    }
  };

  window.addEventListener('resize', broadcastAnchors);
  EnergyLink.startAnchorTracking();
  function bootAnchors() { setTimeout(broadcastAnchors, 30); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAnchors);
  else bootAnchors();
})();`;

export const THREE_ANCHOR_SNIPPET = `// Three.js — bind mesh to SCADA overlay anchor (inside your HTML page)
// Requires: window.THREE, your mesh Object3D, and PerspectiveCamera
EnergyLink.setThreeAnchor('chiller-roof', myMesh, camera, 'Chiller roof');
// Or custom projector:
EnergyLink.setAnchorProjector('meter-a', function() {
  var v = new THREE.Vector3();
  myMesh.getWorldPosition(v);
  v.project(camera);
  var w = window.innerWidth, h = window.innerHeight;
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
});`;

export function resolveAssetRefInHtml(ref: string, assets: Array<{ id: string; url: string }>): string {
  if (!ref.startsWith(ASSET_REF_PREFIX)) return ref;
  const id = ref.slice(ASSET_REF_PREFIX.length);
  return assets.find((a) => a.id === id)?.url ?? '';
}
