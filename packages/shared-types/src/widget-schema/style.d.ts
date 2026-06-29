/** Phase 1 — typed style tokens (stored flat in GraphicObjectDefinition.style). */
export type GradientStop = {
    offset: number;
    color: string;
};
export type FillGradient = {
    type: 'linear' | 'radial';
    angle?: number;
    stops: GradientStop[];
};
export type BoxShadowToken = {
    x: number;
    y: number;
    blur: number;
    spread?: number;
    color: string;
};
export type WidgetStyleSchema = {
    fill?: string;
    fillGradient?: FillGradient;
    background?: string;
    stroke?: string;
    strokeWidth?: number;
    borderColor?: string;
    borderRadius?: number | string;
    opacity?: number;
    boxShadow?: string | BoxShadowToken;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number | string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    letterSpacing?: number;
    lineHeight?: number;
    rotate?: number;
    lockAspectRatio?: boolean;
    objectFit?: 'contain' | 'cover' | 'fill' | 'none';
    padding?: number;
    /** Value / gauge range styling */
    min?: number;
    max?: number;
    unit?: string;
    decimalPlaces?: number;
    trackColor?: string;
    barOrientation?: 'horizontal' | 'vertical';
    onColor?: string;
    offColor?: string;
    transparentBg?: boolean;
    valueVariant?: string;
    buttonActionMode?: 'write' | 'navigate';
    writeValue?: string;
    confirmWrite?: boolean;
    symbolId?: string;
    [key: string]: string | number | boolean | FillGradient | BoxShadowToken | undefined;
};
