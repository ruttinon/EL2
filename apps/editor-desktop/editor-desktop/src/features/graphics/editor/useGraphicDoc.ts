import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GraphicObjectDefinition,
  GraphicSummary,
  GraphicLayout,
  GraphicExternalPage,
  TagSummary,
  DeviceSummary,
  UnifiedCameraPreset,
} from '@energylink/shared-types';
import { GRAPHIC_LAYOUT_VERSION_V2, isHtmlGraphicPage, isGlbBuildingGraphic } from '@energylink/shared-types';
import {
  formatPolygonPointString,
  normalizeLayoutForSave,
  parsePolygonPointString,
  translatePolygonPoints,
} from '@energylink/graphics-runtime';
import { normalizeGraphicLayout } from '@energylink/unified-viewport';
import { makeGlbBuildingObject } from './objectCatalog';

export type Notice = { kind: 'success' | 'error'; text: string } | null;

export type GraphicDoc = {
  ready: boolean;
  hasProject: boolean;
  busy: boolean;
  notice: Notice;
  setNotice: (n: Notice) => void;

  graphics: GraphicSummary[];
  selectedId: string | null;
  selected: GraphicSummary | null;
  objects: GraphicObjectDefinition[];
  dirty: boolean;

  tags: TagSummary[];
  devices: DeviceSummary[];

  selectGraphic: (id: string) => void;
  createGraphic: (name: string, width: number, height: number) => Promise<void>;
  createHtmlGraphic: (name: string, width: number, height: number, externalPage: GraphicExternalPage) => Promise<void>;
  replaceHtmlGraphic: (externalPage: GraphicExternalPage) => Promise<void>;
  createGlbBuildingGraphic: (name: string, width: number, height: number, glbUrl: string) => Promise<void>;
  replaceGlbBuildingGraphic: (glbUrl: string) => Promise<void>;
  deleteGraphic: (id: string) => Promise<void>;
  saveGraphic: () => Promise<void>;
  reload: () => Promise<void>;

  setObjects: (next: GraphicObjectDefinition[], markDirty?: boolean) => void;
  addObject: (obj: GraphicObjectDefinition) => void;
  updateObject: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  removeObject: (id: string) => void;
  patchLayout: (patch: Partial<GraphicLayout>) => void;
};

function genId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}`;
}

export function useGraphicDoc(): GraphicDoc {
  const [ready, setReady] = useState(false);
  const [hasProject, setHasProject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [graphics, setGraphics] = useState<GraphicSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [objects, setObjectsState] = useState<GraphicObjectDefinition[]>([]);
  const [dirty, setDirty] = useState(false);

  const [tags, setTags] = useState<TagSummary[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const selected = useMemo(
    () => graphics.find((g) => g.id === selectedId) ?? null,
    [graphics, selectedId],
  );

  const loadObjectsFor = useCallback((g: GraphicSummary | null) => {
    if (!g) {
      setObjectsState([]);
      return;
    }
    const layout = normalizeGraphicLayout(g.layout);
    setObjectsState(layout.objects ?? []);
    setDirty(false);
  }, []);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const status = await window.energylink.projects.status();
      if (!status.activeProjectId) {
        setHasProject(false);
        setGraphics([]);
        setReady(true);
        return;
      }
      setHasProject(true);
      const [list, tagList, deviceList] = await Promise.all([
        window.energylink.graphics.list(),
        window.energylink.tags.list().catch(() => []),
        window.energylink.devices.list().catch(() => []),
      ]);
      setGraphics(list);
      setTags(tagList);
      setDevices(deviceList);

      const keepId = selectedIdRef.current;
      const keep = keepId ? list.find((g) => g.id === keepId) : undefined;
      const next = keep ?? list.find((g) => g.isDefault) ?? list[0] ?? null;
      setSelectedId(next?.id ?? null);
      loadObjectsFor(next ?? null);
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to load graphics' });
    } finally {
      setReady(true);
      setBusy(false);
    }
  }, [loadObjectsFor]);

  useEffect(() => {
    void reload();
    const onProject = () => void reload();
    window.addEventListener('energylink:active-project-changed', onProject);
    return () => window.removeEventListener('energylink:active-project-changed', onProject);
  }, [reload]);

  const selectGraphic = useCallback(
    (id: string) => {
      const g = graphics.find((x) => x.id === id) ?? null;
      setSelectedId(id);
      loadObjectsFor(g);
    },
    [graphics, loadObjectsFor],
  );

  const createGraphic = useCallback(
    async (name: string, width: number, height: number) => {
      setBusy(true);
      try {
        const created = await window.energylink.graphics.create({
          name: name.trim() || 'Untitled',
          width,
          height,
          layout: {
            version: GRAPHIC_LAYOUT_VERSION_V2,
            pageKind: 'canvas',
            backgroundColor: '#0f172a',
            backgroundImage: null,
            defaultCamera: 'flat',
            objects: [],
          },
        });
        const list = await window.energylink.graphics.list();
        setGraphics(list);
        setSelectedId(created.id);
        loadObjectsFor(list.find((g) => g.id === created.id) ?? created);
        setNotice({ kind: 'success', text: `Created "${created.name}"` });
      } catch (e) {
        setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Create failed' });
      } finally {
        setBusy(false);
      }
    },
    [loadObjectsFor],
  );

  const createHtmlGraphic = useCallback(
    async (name: string, width: number, height: number, externalPage: GraphicExternalPage) => {
      setBusy(true);
      try {
        const created = await window.energylink.graphics.create({
          name: name.trim() || 'HTML Page',
          width,
          height,
          layout: {
            version: GRAPHIC_LAYOUT_VERSION_V2,
            pageKind: 'html',
            backgroundColor: '#0f172a',
            backgroundImage: null,
            defaultCamera: 'flat',
            objects: [],
            externalPage: { sandbox: 'strict', ...externalPage },
          },
        });
        const list = await window.energylink.graphics.list();
        setGraphics(list);
        setSelectedId(created.id);
        loadObjectsFor(list.find((g) => g.id === created.id) ?? created);
        setNotice({ kind: 'success', text: `Imported HTML page "${created.name}"` });
      } catch (e) {
        setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Import failed' });
      } finally {
        setBusy(false);
      }
    },
    [loadObjectsFor],
  );

  const replaceHtmlGraphic = useCallback(
    async (externalPage: GraphicExternalPage) => {
      const g = graphics.find((x) => x.id === selectedIdRef.current);
      if (!g || !isHtmlGraphicPage(g.layout)) return;
      setBusy(true);
      try {
        const layout = normalizeGraphicLayout({
          ...g.layout,
          pageKind: 'html',
          externalPage: { sandbox: 'strict', ...externalPage },
        });
        const saved = await window.energylink.graphics.update({ id: g.id, layout });
        setGraphics((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
        loadObjectsFor(saved);
        setDirty(false);
        setNotice({ kind: 'success', text: 'HTML page updated' });
      } catch (e) {
        setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Replace failed' });
      } finally {
        setBusy(false);
      }
    },
    [graphics, loadObjectsFor],
  );

  const createGlbBuildingGraphic = useCallback(
    async (name: string, width: number, height: number, glbUrl: string) => {
      setBusy(true);
      try {
        const building = makeGlbBuildingObject(width, height, glbUrl, name.trim() || 'Building');
        const created = await window.energylink.graphics.create({
          name: name.trim() || 'GLB Building',
          width,
          height,
          layout: {
            version: GRAPHIC_LAYOUT_VERSION_V2,
            pageKind: 'canvas',
            backgroundColor: '#0f172a',
            backgroundImage: null,
            defaultCamera: 'orbit',
            objects: [building],
          },
        });
        const list = await window.energylink.graphics.list();
        setGraphics(list);
        setSelectedId(created.id);
        loadObjectsFor(list.find((g) => g.id === created.id) ?? created);
        setNotice({ kind: 'success', text: `Imported GLB building "${created.name}"` });
      } catch (e) {
        setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'GLB import failed' });
      } finally {
        setBusy(false);
      }
    },
    [loadObjectsFor],
  );

  const replaceGlbBuildingGraphic = useCallback(
    async (glbUrl: string) => {
      const g = graphics.find((x) => x.id === selectedIdRef.current);
      if (!g || !isGlbBuildingGraphic(g.layout, g.width, g.height)) return;
      setBusy(true);
      try {
        const layout = normalizeGraphicLayout(g.layout);
        const objects = [...(layout.objects ?? [])];
        const idx = objects.findIndex(
          (o) => o.type === 'scene3d' && o.visible !== false && String(o.style?.glbUrl ?? '').trim(),
        );
        if (idx < 0) return;
        const prev = objects[idx];
        objects[idx] = {
          ...prev,
          style: { ...prev.style, glbUrl, sceneBuildMode: 'glb' },
        };
        const saved = await window.energylink.graphics.update({
          id: g.id,
          layout: { ...layout, objects },
        });
        setGraphics((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
        loadObjectsFor(saved);
        setDirty(false);
        setNotice({ kind: 'success', text: 'GLB building updated' });
      } catch (e) {
        setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Replace failed' });
      } finally {
        setBusy(false);
      }
    },
    [graphics, loadObjectsFor],
  );

  const deleteGraphic = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await window.energylink.graphics.delete(id);
        const list = await window.energylink.graphics.list();
        setGraphics(list);
        const next = list[0] ?? null;
        setSelectedId(next?.id ?? null);
        loadObjectsFor(next);
        setNotice({ kind: 'success', text: 'Graphic deleted' });
      } catch (e) {
        setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Delete failed' });
      } finally {
        setBusy(false);
      }
    },
    [loadObjectsFor],
  );

  const saveGraphic = useCallback(async () => {
    const g = graphics.find((x) => x.id === selectedIdRef.current);
    if (!g) return;
    setBusy(true);
    try {
      const camera: UnifiedCameraPreset = g.layout.defaultCamera ?? 'flat';
      const htmlPage = isHtmlGraphicPage(g.layout);
      const layout = normalizeGraphicLayout({
        ...g.layout,
        version: GRAPHIC_LAYOUT_VERSION_V2,
        defaultCamera: camera,
        pageKind: htmlPage ? 'html' : (g.layout.pageKind ?? 'canvas'),
        objects: normalizeLayoutForSave(objects),
      });
      const saved = await window.energylink.graphics.update({ id: g.id, layout });
      setGraphics((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setDirty(false);
      setNotice({ kind: 'success', text: 'Saved' });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  }, [graphics, objects]);

  const setObjects = useCallback((next: GraphicObjectDefinition[], markDirty = true) => {
    setObjectsState(next);
    if (markDirty) setDirty(true);
  }, []);

  const addObject = useCallback((obj: GraphicObjectDefinition) => {
    setObjectsState((prev) => [...prev, obj]);
    setDirty(true);
  }, []);

  const updateObject = useCallback((id: string, patch: Partial<GraphicObjectDefinition>) => {
    setObjectsState((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const next: GraphicObjectDefinition = { ...o, ...patch };
        if (patch.style) {
          next.style = { ...o.style, ...patch.style };
        }
        if (o.type === 'polygon' && next.style && patch.style?.polygonPoints === undefined) {
          const nx = typeof patch.x === 'number' ? patch.x : o.x;
          const ny = typeof patch.y === 'number' ? patch.y : o.y;
          const dx = nx - o.x;
          const dy = ny - o.y;
          if (dx !== 0 || dy !== 0) {
            const pts = parsePolygonPointString(o.style?.polygonPoints);
            if (pts.length >= 3) {
              next.style = {
                ...next.style,
                polygonPoints: formatPolygonPointString(translatePolygonPoints(pts, dx, dy)),
              };
            }
          }
        }
        return next;
      }),
    );
    setDirty(true);
  }, []);

  const removeObject = useCallback((id: string) => {
    setObjectsState((prev) => prev.filter((o) => o.id !== id));
    setDirty(true);
  }, []);

  const patchLayout = useCallback((patch: Partial<GraphicLayout>) => {
    const id = selectedIdRef.current;
    if (!id) return;
    setGraphics((prev) =>
      prev.map((g) => (g.id === id ? { ...g, layout: { ...g.layout, ...patch } } : g)),
    );
    setDirty(true);
  }, []);

  // silence unused warning for genId (kept for potential duplicate action)
  void genId;

  return {
    ready,
    hasProject,
    busy,
    notice,
    setNotice,
    graphics,
    selectedId,
    selected,
    objects,
    dirty,
    tags,
    devices,
    selectGraphic,
    createGraphic,
    createHtmlGraphic,
    replaceHtmlGraphic,
    createGlbBuildingGraphic,
    replaceGlbBuildingGraphic,
    deleteGraphic,
    saveGraphic,
    reload,
    setObjects,
    addObject,
    updateObject,
    removeObject,
    patchLayout,
  };
}
