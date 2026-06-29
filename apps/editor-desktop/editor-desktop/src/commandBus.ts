export type AppModule = 'file' | 'devices' | 'graphics' | 'reports' | 'templates' | 'setup';

export type EditorCommand = {
  module: AppModule;
  item: string;
  issuedAt: number;
};

export const EDITOR_COMMAND_EVENT = 'energylink:editor-command';

export function dispatchEditorCommand(module: AppModule, item: string) {
  window.dispatchEvent(new CustomEvent<EditorCommand>(EDITOR_COMMAND_EVENT, {
    detail: { module, item, issuedAt: Date.now() }
  }));
}

export function normalizeCommand(item: string) {
  return item.trim().toLowerCase().replace(/\s+/g, ' ');
}
