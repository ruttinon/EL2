/** Custom SVG symbol library (Phase 13) */
export type GraphicSymbol = {
    id: string;
    name: string;
    /** Raw SVG markup or data URL */
    svgContent: string;
    viewBox?: string;
    createdAt: string;
};
export declare const GRAPHIC_SYMBOLS_STORAGE_KEY = "energylink.setup.symbols.v1";
