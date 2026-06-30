import { useMemo, useState } from 'react';
import { MousePointer2, Hand, Shapes, Upload } from 'lucide-react';
import { RAIL_TOOLS, toolKey, legacyPaletteCategories } from './objectCatalog';
import { allSymbols, importSvgToLibrary, symbolToolKey } from '../graphicSymbols';
import { WidgetPalette } from '../widget-registry/WidgetPalette';

export type ActiveTool = string;

export type ToolRailProps = {
  activeTool: ActiveTool;
  onPickTool: (tool: ActiveTool) => void;
  disabled?: boolean;
  layout?: 'float' | 'dock';
};

export type WidgetLibraryProps = {
  activeTool: ActiveTool;
  onPickTool: (tool: ActiveTool) => void;
  editorUiMode?: 'simple' | 'advanced' | 'building';
};

export function WidgetLibrary({ activeTool, onPickTool, editorUiMode = 'simple' }: WidgetLibraryProps) {
  const [symbols, setSymbols] = useState(() => allSymbols());
  const refreshSymbols = () => setSymbols(allSymbols());

  const pick = (tool: ActiveTool) => onPickTool(tool);

  const legacyCategories = useMemo(
    () => legacyPaletteCategories().map((cat) => ({
      id: cat.id,
      label: cat.label,
      group: cat.group,
      tools: cat.tools.map((t) => ({
        key: toolKey(t),
        label: t.label,
        icon: t.icon,
        color: t.color,
      })),
    })),
    [],
  );

  const importSvg = async (file?: File | null) => {
    if (!file) return;
    try {
      const sym = await importSvgToLibrary(file);
      refreshSymbols();
      pick(symbolToolKey(sym.id));
    } catch {
      // invalid SVG
    }
  };

  return (
    <div className="tr-flyout-body tr-flyout-embedded">
      <WidgetPalette activeTool={activeTool} onPickTool={pick} legacyCategories={legacyCategories} editorUiMode={editorUiMode} />
      <div className="tr-group">
        <div className="tr-group-title">Symbols</div>
        <section className="tr-cat">
          <label className="tr-symbol-import">
            <Upload size={14} /> Import SVG
            <input type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => void importSvg(e.target.files?.[0])} />
          </label>
          <div className="tr-symbol-grid">
            {symbols.map((sym) => {
              const k = symbolToolKey(sym.id);
              return (
                <button
                  key={sym.id}
                  type="button"
                  className={`tr-symbol-item${activeTool === k ? ' active' : ''}`}
                  title={sym.name}
                  onClick={() => pick(k)}
                >
                  <span className="tr-symbol-thumb" dangerouslySetInnerHTML={{ __html: sym.svgContent }} />
                  <span>{sym.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ToolQuickBar({ activeTool, onPickTool, disabled, layout = 'float' }: ToolRailProps) {
  const [flyout, setFlyout] = useState(false);
  const pick = (tool: ActiveTool) => {
    setFlyout(false);
    onPickTool(tool);
  };

  const rail = (
    <div className={`tr-rail${layout === 'dock' ? ' tr-rail-dock' : ''}`}>
      <button
        type="button"
        className={`tr-btn${activeTool === 'select' ? ' active' : ''}`}
        title="Select (V)"
        onClick={() => pick('select')}
      >
        <MousePointer2 size={layout === 'dock' ? 18 : 22} />
      </button>
      <button
        type="button"
        className={`tr-btn${activeTool === 'pan' ? ' active' : ''}`}
        title="Pan (H)"
        onClick={() => pick('pan')}
      >
        <Hand size={layout === 'dock' ? 18 : 22} />
      </button>
      <div className="tr-divider" />
      {RAIL_TOOLS.map((t) => {
        const IconCmp = t.icon;
        const k = toolKey(t);
        return (
          <button
            key={k}
            type="button"
            className={`tr-btn${activeTool === k ? ' active' : ''}`}
            title={t.label}
            onClick={() => pick(k)}
          >
            <IconCmp size={layout === 'dock' ? 18 : 22} color={t.color} />
          </button>
        );
      })}
      {layout === 'float' ? (
        <>
          <div className="tr-divider" />
          <button
            type="button"
            className={`tr-btn tr-widgets${flyout ? ' active' : ''}`}
            title="Widgets"
            onClick={() => setFlyout((v) => !v)}
          >
            <Shapes size={22} color="#a855f7" />
          </button>
        </>
      ) : null}
    </div>
  );

  if (layout === 'dock') {
    return <div className={`tr-wrap tr-wrap-dock${disabled ? ' tr-disabled' : ''}`}>{rail}</div>;
  }

  return (
    <div className={`tr-wrap${disabled ? ' tr-disabled' : ''}`}>
      {rail}
      {flyout ? (
        <div className="tr-flyout" onPointerLeave={() => setFlyout(false)}>
          <div className="tr-flyout-head">Widgets</div>
          <WidgetLibrary activeTool={activeTool} onPickTool={pick} />
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use ToolQuickBar with layout="float" or EditorLeftDock */
export function ToolRail(props: ToolRailProps) {
  return <ToolQuickBar {...props} layout={props.layout ?? 'float'} />;
}
