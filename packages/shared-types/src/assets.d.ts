/** Graphic asset library — images, 3D, lottie, video (Phase 9) */
export type GraphicAssetKind = 'image' | 'model3d' | 'lottie' | 'video' | 'sprite' | 'svg' | 'spline' | 'html';
export type GraphicAsset = {
    id: string;
    name: string;
    kind: GraphicAssetKind;
    /** data: URL or http(s) URL */
    url: string;
    mimeType?: string;
    fileSize?: number;
    createdAt: string;
    /** Optional real-world dimensions for equipment images / models (mm) */
    realWidthMm?: number;
    realHeightMm?: number;
};
export type GraphicAssetBundle = {
    version: 1;
    assets: GraphicAsset[];
};
export declare const GRAPHIC_ASSET_BUNDLE_VERSION: 1;
