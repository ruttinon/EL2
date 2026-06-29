import type { GraphicLayout } from './graphics.js';
/** Normalize layout to v2 — unified layers + defaultCamera; strips legacy sceneViewMode */
export declare function normalizeGraphicLayout(layout: GraphicLayout | null | undefined): GraphicLayout;
