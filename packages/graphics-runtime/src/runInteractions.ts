import type { WidgetInteraction, WidgetInteractionAction } from '@energylink/shared-types';
import type { WriteTagOptions } from './objectLogic';

export type RunInteractionsContext = {
  fireWrite: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
  onNavigate?: (graphicId: string) => void;
  confirm?: (message: string) => boolean;
};

function defaultConfirm(message: string): boolean {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
}

function runAction(
  action: WidgetInteractionAction,
  ctx: RunInteractionsContext,
): void {
  switch (action.type) {
    case 'writeTag':
      ctx.fireWrite(
        action.tagId,
        action.tagId,
        action.dataType ?? (typeof action.value === 'boolean' ? 'bool' : 'uint16'),
        { presetValue: action.value },
      );
      break;
    case 'toggleTag': {
      // Runtime caller should pass current value via valuesByTag in future; for now write onValue.
      ctx.fireWrite(
        action.tagId,
        action.tagId,
        'bool',
        { presetValue: action.onValue ?? true },
      );
      break;
    }
    case 'navigate':
      ctx.onNavigate?.(action.graphicId);
      break;
    case 'openPopup':
      ctx.onNavigate?.(action.graphicId);
      break;
    case 'openUrl':
      if (typeof window !== 'undefined') {
        window.open(action.url, action.target ?? '_blank');
      }
      break;
    case 'confirm': {
      const ok = (ctx.confirm ?? defaultConfirm)(action.message);
      if (ok) runActions(action.actions, ctx);
      break;
    }
    case 'script':
      // Phase 2c — script hooks wired when engine exposes script runner
      break;
    default:
      break;
  }
}

function runActions(actions: WidgetInteractionAction[], ctx: RunInteractionsContext): void {
  for (const action of actions) {
    runAction(action, ctx);
  }
}

/** Execute declarative interactions for a trigger (click, dblclick, …). */
export function runInteractions(
  interactions: WidgetInteraction[] | undefined,
  trigger: WidgetInteraction['trigger'],
  ctx: RunInteractionsContext,
): boolean {
  if (!interactions?.length) return false;
  const matched = interactions.filter((ix) => ix.trigger === trigger && ix.enabled !== false);
  if (matched.length === 0) return false;
  for (const ix of matched) {
    runActions(ix.actions, ctx);
  }
  return true;
}
