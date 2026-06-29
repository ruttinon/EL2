/** Phase 1 interaction / action schema (stored on object; legacy write via style.writeValue). */

export type InteractionTrigger = 'click' | 'dblclick' | 'press' | 'release' | 'longPress';

export type WriteTagAction = {
  type: 'writeTag';
  tagId: string;
  value: string | number | boolean;
  dataType?: string;
};

export type ToggleTagAction = {
  type: 'toggleTag';
  tagId: string;
  onValue?: string | number | boolean;
  offValue?: string | number | boolean;
};

export type NavigateAction = {
  type: 'navigate';
  graphicId: string;
  params?: Record<string, string>;
};

export type OpenPopupAction = {
  type: 'openPopup';
  graphicId: string;
  modal?: boolean;
  width?: number;
  height?: number;
};

export type ConfirmAction = {
  type: 'confirm';
  message: string;
  actions: WidgetInteractionAction[];
};

export type ScriptAction = {
  type: 'script';
  scriptId: string;
  args?: Record<string, unknown>;
};

export type WidgetInteractionAction =
  | WriteTagAction
  | ToggleTagAction
  | NavigateAction
  | OpenPopupAction
  | ConfirmAction
  | ScriptAction
  | { type: 'openUrl'; url: string; target?: '_blank' | '_self' };

export type WidgetInteraction = {
  id: string;
  trigger: InteractionTrigger;
  label?: string;
  enabled?: boolean;
  actions: WidgetInteractionAction[];
};

/** Container on graphic object (Phase 1 optional field `interactions`). */
export type WidgetActionSchema = {
  interactions?: WidgetInteraction[];
};
