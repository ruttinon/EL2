import type { DeviceSummary, GraphicObjectDefinition, GraphicSummary, TagSummary } from '@energylink/shared-types';
import type { WidgetDefinition } from '@energylink/widget-registry';
import { getWidgetByObjectType, resolveInspectorGroups } from '@energylink/widget-registry';
import { FieldRenderer } from './FieldRenderer';
import { ValueWidgetInspector } from '../editor/inspector/widgets/ValueWidgetInspector';
import { GaugeMiniInspector } from './inspectors/GaugeMiniInspector';
import { ButtonMiniInspector } from './inspectors/ButtonMiniInspector';
import { StatusMiniInspector } from './inspectors/StatusMiniInspector';
import { StatusAppearancePanel } from './inspectors/StatusAppearancePanel';
import { ElecSymbolMiniInspector } from './inspectors/ElecSymbolMiniInspector';
import { SwitchMiniInspector } from './inspectors/SwitchMiniInspector';
import { ClockInspector } from '../editor/inspector/widgets/ClockInspector';
import { ChartInspector } from '../editor/inspector/widgets/ChartInspector';
import { TableInspector } from '../editor/inspector/widgets/TableInspector';
import { ThresholdMiniInspector, widgetHasThresholds } from './inspectors/ThresholdMiniInspector';
import {
  SliderMiniInspector,
  InputMiniInspector,
  DropdownMiniInspector,
  NavMiniInspector,
  TabbarMiniInspector,
} from './inspectors/ControlMiniInspectors';
import { AnimationMiniInspector, widgetHasAnimation } from './inspectors/AnimationMiniInspector';
import { ValueRulesMiniInspector, widgetSupportsValueRules } from './inspectors/ValueRulesMiniInspector';
import {
  ShapeMiniInspector,
  FlowPathMiniInspector,
  ImageMiniInspector,
  VideoMiniInspector,
} from './inspectors/LayoutMiniInspectors';
import {
  GroupMiniInspector,
  View3dMiniInspector,
  IframeMiniInspector,
  SpriteMiniInspector,
  LottieMiniInspector,
  WallMiniInspector,
  Cable3dMiniInspector,
  HotspotWithZone3d,
} from './inspectors/SceneMiniInspectors';

export type InspectorComposerProps = {
  selected: GraphicObjectDefinition;
  tags: TagSummary[];
  devices: DeviceSummary[];
  graphics: GraphicSummary[];
  currentGraphicId: string | null;
  objects?: GraphicObjectDefinition[];
  onUngroupGroup?: (groupId: string) => void;
  onStartPathEdit?: (objectId: string) => void;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  /** Schema inspector groups to hide (e.g. layout in report designer). */
  hiddenGroups?: string[];
};

function getPathValue(obj: GraphicObjectDefinition, path: string): unknown {
  if (path.startsWith('_meta.')) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setPathPatch(
  obj: GraphicObjectDefinition,
  path: string,
  value: unknown,
): Partial<GraphicObjectDefinition> {
  if (path === 'name') return { name: String(value ?? '') };
  if (path === 'text') return { text: String(value ?? '') };
  if (path === 'navigateTo') return { navigateTo: String(value ?? '') || undefined };
  if (path === 'x' || path === 'y' || path === 'width' || path === 'height' || path === 'layer') {
    const n = Number(value);
    return Number.isFinite(n) ? { [path]: n } : {};
  }
  if (path === 'visible' || path === 'locked') {
    return { [path]: Boolean(value) };
  }
  if (path.startsWith('style.')) {
    const key = path.slice(6);
    const next = { ...obj.style, [key]: value as string | number | boolean | undefined };
    if (key === 'fill' && typeof value === 'string') next.background = value;
    if (key === 'stroke' && typeof value === 'string') next.borderColor = value;
    return { style: next };
  }
  if (path.startsWith('binding.')) {
    const key = path.slice(8);
    const binding = { ...obj.binding, [key]: value };
    if (key === 'tagId') {
      return { binding, tagId: typeof value === 'string' ? value : undefined };
    }
    return { binding };
  }
  return {};
}

export function InspectorComposer({
  selected,
  tags,
  devices,
  graphics,
  currentGraphicId,
  objects = [],
  onUngroupGroup,
  onStartPathEdit,
  onUpdate,
  hiddenGroups = [],
}: InspectorComposerProps) {
  const def: WidgetDefinition | undefined = getWidgetByObjectType(selected.type);
  if (!def) return null;

  const groups = resolveInspectorGroups(def.inspector.groups).filter((g) => !hiddenGroups.includes(g.id));
  const tagOptions = tags;

  const patchField = (path: string, value: unknown) => {
    onUpdate(selected.id, setPathPatch(selected, path, value));
  };

  const dedicated = def.inspector.dedicatedInspector;
  const showThresholds = widgetHasThresholds(def.inspector.groups);
  const showAnimation = widgetHasAnimation(def.inspector.groups);
  const showValueRules = widgetSupportsValueRules(selected.type, selected.style);
  const schemaGroups = groups.filter((g) => {
    if (showThresholds && g.id === 'thresholds') return false;
    if (showAnimation && g.id === 'animation') return false;
    if (dedicated === 'hotspot' && g.id === 'navigation') return false;
    if (dedicated === 'group' && g.id === 'navigation') return false;
    if ((dedicated === 'nav' || dedicated === 'tabbar') && g.id === 'navigation') return false;
    if (dedicated === 'button' && (g.id === 'appearance' || g.id === 'typography' || g.id === 'interaction' || g.id === 'navigation')) {
      return false;
    }
    if ((dedicated === 'gauge' || dedicated === 'chart' || dedicated === 'value') && (g.id === 'appearance' || g.id === 'typography')) {
      return false;
    }
    return true;
  });

  return (
    <div className="ins-composer">
      {!hiddenGroups.includes('layout') ? (
        <header className="ins-composer-head">
          <h3>{def.display.label}</h3>
          {def.display.hint ? <p>{def.display.hint}</p> : null}
        </header>
      ) : null}

      {dedicated === 'value' ? (
        <ValueWidgetInspector selected={selected} tagOptions={tagOptions} tags={tags} devices={devices} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'gauge' ? (
        <GaugeMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'button' ? (
        <ButtonMiniInspector
          selected={selected}
          devices={devices}
          tags={tags}
          graphics={graphics}
          currentGraphicId={currentGraphicId}
          onUpdate={onUpdate}
        />
      ) : null}
      {dedicated === 'status' ? (
        <>
          <StatusMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} />
          {String(selected.style?.statusVariant ?? 'lamp') !== 'badge' ? (
            <StatusAppearancePanel selected={selected} tags={tags} onUpdate={onUpdate} />
          ) : null}
        </>
      ) : null}
      {dedicated === 'elecsymbol' ? (
        <ElecSymbolMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'switch' ? (
        <SwitchMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'clock' ? (
        <ClockInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'chart' ? (
        <ChartInspector selected={selected} tagOptions={tagOptions} devices={devices} tags={tags} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'table' ? (
        <TableInspector selected={selected} devices={devices} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'slider' ? (
        <SliderMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'input' ? (
        <InputMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'dropdown' ? (
        <DropdownMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'nav' ? (
        <NavMiniInspector selected={selected} graphics={graphics} currentGraphicId={currentGraphicId} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'tabbar' ? (
        <TabbarMiniInspector selected={selected} graphics={graphics} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'shape' ? (
        <ShapeMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'image' ? (
        <ImageMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'video' ? (
        <VideoMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'flowpath' ? (
        <FlowPathMiniInspector selected={selected} devices={devices} tags={tags} onUpdate={onUpdate} onStartPathEdit={onStartPathEdit} />
      ) : null}
      {dedicated === 'hotspot' ? (
        <HotspotWithZone3d selected={selected} graphics={graphics} currentGraphicId={currentGraphicId} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'group' ? (
        <GroupMiniInspector selected={selected} objects={objects} onUpdate={onUpdate} onUngroupGroup={onUngroupGroup} />
      ) : null}
      {dedicated === 'view3d' ? (
        <View3dMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'iframe' ? (
        <IframeMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'sprite' ? (
        <SpriteMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'lottie' ? (
        <LottieMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'wall' ? (
        <WallMiniInspector selected={selected} onUpdate={onUpdate} />
      ) : null}
      {dedicated === 'cable3d' ? (
        <Cable3dMiniInspector selected={selected} objects={objects} onUpdate={onUpdate} />
      ) : null}

      {showThresholds || showValueRules || showAnimation ? (
        <details className="ins-composer-group" open={false}>
          <summary>Advanced Options</summary>
          <div className="ins-composer-fields">
            {showThresholds ? (
              <ThresholdMiniInspector selected={selected} onUpdate={onUpdate} />
            ) : null}

            {showValueRules ? (
              <ValueRulesMiniInspector selected={selected} tags={tags} onUpdate={onUpdate} />
            ) : null}

            {showAnimation ? (
              <AnimationMiniInspector selected={selected} tags={tags} onUpdate={onUpdate} />
            ) : null}
          </div>
        </details>
      ) : null}

      {schemaGroups.map((group) => {
        const visibleFields = group.fields.filter((f) => {
          if (f.path.startsWith('_meta.')) return false;
          if (f.path === 'name' && (dedicated === 'gauge' || dedicated === 'chart' || dedicated === 'value')) return false;
          return true;
        });
        if (visibleFields.length === 0) return null;
        const collapsed = group.tier === 'advanced';
        return (
          <details key={`${def.id}-${group.id}`} className="ins-composer-group" open={!collapsed}>
            <summary>{group.title}</summary>
            <div className="ins-composer-fields">
              {visibleFields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={getPathValue(selected, field.path)}
                  tagOptions={tagOptions}
                  onChange={(v) => patchField(field.path, v)}
                />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
