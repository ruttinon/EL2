import { useMemo, useState } from 'react';
import type { WidgetCategoryMeta, WidgetDefinition } from '@energylink/widget-registry';
import {
  listPaletteWidgets,
  registryPaletteCategories,
  registryToolKey,
} from '@energylink/widget-registry';
import { resolveRegistryIcon, widgetDefToToolDef } from './bridge';
import type { LucideIcon } from 'lucide-react';
import { Search, Star, Clock, ThumbsUp, ChevronDown, ChevronRight } from 'lucide-react';
import type { ActiveTool } from '../editor/ToolRail';

type PaletteGroup = 'display' | 'action';

export type WidgetPaletteProps = {
  activeTool: ActiveTool;
  onPickTool: (tool: ActiveTool) => void;
  editorUiMode?: 'simple' | 'advanced' | 'building';
  /** Legacy tools from objectCatalog (non-registry) */
  legacyCategories?: Array<{
    id: string;
    label: string;
    group: PaletteGroup;
    tools: Array<{ key: string; label: string; icon: LucideIcon; color: string }>;
  }>;
};

const CATEGORY_LABELS: Record<string, string> = {
  layout: 'Basic (วาดรูปทั่วไป)',
  values: 'Values (ค่ามอนิเตอร์)',
  charts: 'Charts (กราฟวิเคราะห์)',
  tables: 'Tables (ตารางระบบ)',
  'symbols.electrical': 'SLD (ไดอะแกรมไฟฟ้า)',
  media: 'Media / 3D (สื่อมีเดีย)',
  controls: 'Controls (สั่งการเครื่องจักร)',
  navigation: 'Navigation (ปุ่มนำทาง)',
};

const RECOMMENDED_IDS = [
  'text',
  'rectangle',
  'value',
  'kpicard',
  'trend',
  'alarmtable',
  'button',
  'switch',
  'elecsymbol'
];

function getToolBadge(category: string, type: string): string | null {
  if (category === 'symbols.electrical') return 'SLD';
  if (category === 'controls') return 'Action';
  if (category === 'media' || type === 'scene3d') return '3D/Media';
  if (category === 'values') return 'Display';
  return null;
}

export function WidgetPalette({
  activeTool,
  onPickTool,
  legacyCategories = [],
  editorUiMode = 'simple',
}: WidgetPaletteProps) {
  const [search, setSearch] = useState('');
  const [openCat, setOpenCat] = useState<string | null>('values');

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('energylink:favorite-tools') || '[]');
    } catch {
      return [];
    }
  });

  const [recents, setRecents] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('energylink:recent-tools') || '[]');
    } catch {
      return [];
    }
  });

  const registryCats = useMemo(() => registryPaletteCategories(), []);
  const registryWidgets = useMemo(() => listPaletteWidgets(), []);

  // Filter tools based on simple/building mode
  const filteredRegistryWidgets = useMemo(() => {
    return registryWidgets.filter((w) => {
      // If building mode, show everything or highlight 3D
      if (editorUiMode === 'building') {
        return true;
      }
      if (editorUiMode === 'simple') {
        // Simple mode hides advanced things or keeping only general widgets
        if (w.id === 'lottie' || w.id === 'sprite' || w.id === 'wall3d' || w.id === 'cable3d' || w.id === 'multipointline') {
          return false;
        }
      }
      return true;
    });
  }, [registryWidgets, editorUiMode]);

  const widgetsByCat = useMemo(() => {
    const map = new Map<string, typeof filteredRegistryWidgets>();
    for (const cat of registryCats) {
      map.set(cat.id, filteredRegistryWidgets.filter((w) => w.category === cat.id));
    }
    return map;
  }, [registryCats, filteredRegistryWidgets]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('energylink:favorite-tools', JSON.stringify(next));
      return next;
    });
  };

  const handleSelectTool = (id: string) => {
    onPickTool(id);
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8);
      localStorage.setItem('energylink:recent-tools', JSON.stringify(next));
      return next;
    });
  };

  // Search filter
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return filteredRegistryWidgets.filter(
      (w) =>
        w.id.toLowerCase().includes(q) ||
        w.display.label.toLowerCase().includes(q) ||
        (w.display.hint && w.display.hint.toLowerCase().includes(q))
    );
  }, [filteredRegistryWidgets, search]);

  const favoriteWidgets = useMemo(() => {
    return filteredRegistryWidgets.filter((w) => favorites.includes(w.id));
  }, [filteredRegistryWidgets, favorites]);

  const recentWidgets = useMemo(() => {
    return recents
      .map((id) => filteredRegistryWidgets.find((w) => w.id === id))
      .filter((w): w is WidgetDefinition => !!w);
  }, [filteredRegistryWidgets, recents]);

  const recommendedWidgets = useMemo(() => {
    return filteredRegistryWidgets.filter((w) => RECOMMENDED_IDS.includes(w.id));
  }, [filteredRegistryWidgets]);

  return (
    <div className="wr-palette" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8 }}>
      {/* Search Input */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={14} style={{ position: 'absolute', left: 8, color: '#64748b' }} />
        <input
          type="text"
          placeholder="ค้นหาเครื่องมือออกแบบ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px 6px 28px',
            fontSize: 12,
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            outline: 'none',
            background: '#ffffff'
          }}
        />
      </div>

      {search.trim() ? (
        /* Search Results Flat List */
        <div className="wr-palette-group">
          <div className="wr-palette-group-title">ผลการค้นหา ({searchResults.length})</div>
          {searchResults.length === 0 ? (
            <div style={{ padding: 12, fontSize: 11, color: '#64748b', textAlign: 'center' }}>ไม่พบเครื่องมือที่ตรงกัน</div>
          ) : (
            <div className="wr-palette-grid">
              {searchResults.map((def) => (
                <WidgetPaletteItem
                  key={def.id}
                  def={def}
                  activeTool={activeTool}
                  isFavorite={favorites.includes(def.id)}
                  onSelect={handleSelectTool}
                  onFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Normal Layout (Favorites, Recents, Categories) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Favorites Category */}
          {favoriteWidgets.length > 0 && (
            <section className="wr-palette-cat">
              <button
                type="button"
                className="wr-palette-cat-head"
                onClick={() => setOpenCat((v) => (v === 'favs' ? null : 'favs'))}
                style={{ background: '#fffbeb', borderLeft: '3px solid #f59e0b' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <span style={{ fontWeight: 'bold', color: '#78350f' }}>เครื่องมือโปรด (Favorites)</span>
                </div>
                <small style={{ background: '#fef3c7', color: '#b45309' }}>{favoriteWidgets.length}</small>
              </button>
              {openCat === 'favs' && (
                <div className="wr-palette-grid">
                  {favoriteWidgets.map((def) => (
                    <WidgetPaletteItem
                      key={def.id}
                      def={def}
                      activeTool={activeTool}
                      isFavorite={true}
                      onSelect={handleSelectTool}
                      onFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recently Used Category */}
          {recentWidgets.length > 0 && (
            <section className="wr-palette-cat">
              <button
                type="button"
                className="wr-palette-cat-head"
                onClick={() => setOpenCat((v) => (v === 'recents' ? null : 'recents'))}
                style={{ background: '#f0fdf4', borderLeft: '3px solid #22c55e' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} color="#22c55e" />
                  <span style={{ fontWeight: 'bold', color: '#14532d' }}>ใช้ล่าสุด (Recents)</span>
                </div>
                <small style={{ background: '#dcfce7', color: '#15803d' }}>{recentWidgets.length}</small>
              </button>
              {openCat === 'recents' && (
                <div className="wr-palette-grid">
                  {recentWidgets.map((def) => (
                    <WidgetPaletteItem
                      key={def.id}
                      def={def}
                      activeTool={activeTool}
                      isFavorite={favorites.includes(def.id)}
                      onSelect={handleSelectTool}
                      onFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Recommended / Quick Tools Category */}
          <section className="wr-palette-cat">
            <button
              type="button"
              className="wr-palette-cat-head"
              onClick={() => setOpenCat((v) => (v === 'recoms' ? null : 'recoms'))}
              style={{ background: '#eff6ff', borderLeft: '3px solid #2563eb' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ThumbsUp size={14} color="#2563eb" />
                <span style={{ fontWeight: 'bold', color: '#1e3a8a' }}>เครื่องมือแนะนำ (Recommended)</span>
              </div>
              <small style={{ background: '#dbeafe', color: '#1d4ed8' }}>{recommendedWidgets.length}</small>
            </button>
            {openCat === 'recoms' && (
              <div className="wr-palette-grid">
                {recommendedWidgets.map((def) => (
                  <WidgetPaletteItem
                    key={def.id}
                    def={def}
                    activeTool={activeTool}
                    isFavorite={favorites.includes(def.id)}
                    onSelect={handleSelectTool}
                    onFavorite={toggleFavorite}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Standard Categories */}
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: 6, paddingLeft: 4 }}>หมวดหมู่เครื่องมือ</span>
            {registryCats.map((cat) => {
              const list = widgetsByCat.get(cat.id) ?? [];
              if (list.length === 0) return null;
              const title = CATEGORY_LABELS[cat.id] ?? cat.label;
              const isOpen = openCat === cat.id;

              return (
                <section key={cat.id} className="wr-palette-cat" style={{ marginBottom: 4 }}>
                  <button
                    type="button"
                    className="wr-palette-cat-head"
                    onClick={() => setOpenCat(isOpen ? null : cat.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isOpen ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
                      <span>{title}</span>
                    </div>
                    <small>{list.length}</small>
                  </button>
                  {isOpen && (
                    <div className="wr-palette-grid">
                      {list.map((def) => (
                        <WidgetPaletteItem
                          key={def.id}
                          def={def}
                          activeTool={activeTool}
                          isFavorite={favorites.includes(def.id)}
                          onSelect={handleSelectTool}
                          onFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Legacy/Basic Tools Category */}
            {legacyCategories.length > 0 &&
              legacyCategories.map((cat) => {
                const isOpen = openCat === cat.id;
                return (
                  <section key={cat.id} className="wr-palette-cat" style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="wr-palette-cat-head"
                      onClick={() => setOpenCat(isOpen ? null : cat.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isOpen ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
                        <span>{cat.label} (Legacy)</span>
                      </div>
                      <small>{cat.tools.length}</small>
                    </button>
                    {isOpen && (
                      <div className="wr-palette-grid">
                        {cat.tools.map((t) => {
                          const Icon = t.icon;
                          const k = t.key;
                          return (
                            <button
                              key={k}
                              type="button"
                              className={`wr-palette-item${activeTool === k ? ' active' : ''}`}
                              onClick={() => handleSelectTool(k)}
                              title={t.label}
                              style={{ position: 'relative' }}
                            >
                              <Icon size={20} color={t.color} />
                              <span style={{ fontSize: 10 }}>{t.label}</span>
                              <span style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                fontSize: 8,
                                background: '#e2e8f0',
                                padding: '1px 3px',
                                borderRadius: 3,
                                color: '#475569',
                                scale: '0.85'
                              }}>
                                Basic
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function WidgetPaletteItem({
  def,
  activeTool,
  isFavorite,
  onSelect,
  onFavorite,
}: {
  def: WidgetDefinition;
  activeTool: ActiveTool;
  isFavorite: boolean;
  onSelect: (id: string) => void;
  onFavorite: (id: string, e: React.MouseEvent) => void;
}) {
  const tool = widgetDefToToolDef(def);
  const k = registryToolKey(def);
  const Icon = resolveRegistryIcon(def.display.icon);
  const badge = getToolBadge(def.category, def.id);

  return (
    <button
      type="button"
      className={`wr-palette-item${activeTool === k ? ' active' : ''}`}
      onClick={() => onSelect(k)}
      title={def.display.hint ?? tool.label}
      style={{ position: 'relative', overflow: 'visible', padding: '12px 4px 6px 4px' }}
    >
      {/* Favorite Toggle Star */}
      <div
        onClick={(e) => onFavorite(def.id, e)}
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          cursor: 'pointer',
          padding: 2,
          opacity: isFavorite ? 1 : 0.2,
          transition: 'all 0.15s ease'
        }}
        className="wr-item-fav-star"
      >
        <Star size={10} color={isFavorite ? '#f59e0b' : '#64748b'} fill={isFavorite ? '#f59e0b' : 'transparent'} />
      </div>

      <Icon size={20} color={def.display.color} />
      <span style={{ fontSize: 10, wordBreak: 'break-word', marginTop: 2 }}>{def.display.label}</span>

      {/* Tool Category Badge */}
      {badge && (
        <span style={{
          position: 'absolute',
          top: 2,
          right: 2,
          fontSize: 7,
          background: badge === 'SLD' ? '#fef3c7' : badge === 'Action' ? '#fee2e2' : badge === '3D/Media' ? '#f3e8ff' : '#dbeafe',
          color: badge === 'SLD' ? '#b45309' : badge === 'Action' ? '#ef4444' : badge === '3D/Media' ? '#7c3aed' : '#1d4ed8',
          padding: '1px 3px',
          borderRadius: 3,
          fontWeight: 'bold',
          scale: '0.85'
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}
