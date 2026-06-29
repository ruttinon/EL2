import { useMemo, useState } from 'react';
import type { WidgetCategoryMeta } from '@energylink/widget-registry';
import {
  listPaletteWidgets,
  registryPaletteCategories,
  registryToolKey,
} from '@energylink/widget-registry';
import { resolveRegistryIcon, widgetDefToToolDef } from './bridge';
import type { LucideIcon } from 'lucide-react';
import type { ActiveTool } from '../editor/ToolRail';

type PaletteGroup = 'display' | 'action';

export type WidgetPaletteProps = {
  activeTool: ActiveTool;
  onPickTool: (tool: ActiveTool) => void;
  /** Legacy tools from objectCatalog (non-registry) */
  legacyCategories?: Array<{
    id: string;
    label: string;
    group: PaletteGroup;
    tools: Array<{ key: string; label: string; icon: LucideIcon; color: string }>;
  }>;
};

const GROUPS: { id: PaletteGroup; label: string }[] = [
  { id: 'display', label: 'Display' },
  { id: 'action', label: 'Action' },
];

export function WidgetPalette({ activeTool, onPickTool, legacyCategories = [] }: WidgetPaletteProps) {
  const [openCat, setOpenCat] = useState<string | null>('layout');
  const registryCats = useMemo(() => registryPaletteCategories(), []);
  const registryWidgets = useMemo(() => listPaletteWidgets(), []);

  const widgetsByCat = useMemo(() => {
    const map = new Map<string, typeof registryWidgets>();
    for (const cat of registryCats) {
      map.set(cat.id, registryWidgets.filter((w) => w.category === cat.id));
    }
    return map;
  }, [registryCats, registryWidgets]);

  return (
    <div className="wr-palette">
      {GROUPS.map((grp) => {
        const cats = registryCats.filter((c) => c.paletteGroup === grp.id);
        if (cats.length === 0) return null;
        return (
          <div key={grp.id} className="wr-palette-group">
            <div className="wr-palette-group-title">{grp.label}</div>
            {cats.map((cat) => (
              <RegistryCategorySection
                key={cat.id}
                cat={cat}
                widgets={widgetsByCat.get(cat.id) ?? []}
                open={openCat === cat.id}
                onToggle={() => setOpenCat((v) => (v === cat.id ? null : cat.id))}
                activeTool={activeTool}
                onPickTool={onPickTool}
              />
            ))}
          </div>
        );
      })}

      {legacyCategories.length > 0 ? (
        <div className="wr-palette-group">
          <div className="wr-palette-group-title">Basic Tools</div>
          {legacyCategories.map((cat) => (
            <section key={cat.id} className="wr-palette-cat">
              <button type="button" className="wr-palette-cat-head" onClick={() => setOpenCat((v) => (v === cat.id ? null : cat.id))}>
                {cat.label}
              </button>
              {openCat === cat.id ? (
                <div className="wr-palette-grid">
                  {cat.tools.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        className={`wr-palette-item${activeTool === t.key ? ' active' : ''}`}
                        onClick={() => onPickTool(t.key)}
                        title={t.label}
                      >
                        <Icon size={20} color={t.color} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RegistryCategorySection({
  cat,
  widgets,
  open,
  onToggle,
  activeTool,
  onPickTool,
}: {
  cat: WidgetCategoryMeta;
  widgets: ReturnType<typeof listPaletteWidgets>;
  open: boolean;
  onToggle: () => void;
  activeTool: ActiveTool;
  onPickTool: (tool: ActiveTool) => void;
}) {
  return (
    <section className="wr-palette-cat">
      <button type="button" className="wr-palette-cat-head" onClick={onToggle}>
        <span>{cat.label}</span>
        <small>{widgets.length}</small>
      </button>
      {open ? (
        <div className="wr-palette-grid">
          {widgets.map((def) => {
            const tool = widgetDefToToolDef(def);
            const k = registryToolKey(def);
            const Icon = resolveRegistryIcon(def.display.icon);
            return (
              <button
                key={def.id}
                type="button"
                className={`wr-palette-item${activeTool === k ? ' active' : ''}`}
                onClick={() => onPickTool(k)}
                title={def.display.hint ?? tool.label}
              >
                <Icon size={20} color={def.display.color} />
                <span>{def.display.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
