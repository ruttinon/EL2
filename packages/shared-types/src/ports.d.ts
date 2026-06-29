/** Connection ports + wire bindings (Phase 10) */
export type PortKind = 'in' | 'out' | 'bidirectional';
export type GraphicPort = {
    id: string;
    /** 0–1 relative to object width */
    x: number;
    /** 0–1 relative to object height */
    y: number;
    label?: string;
    kind?: PortKind;
};
/** Parse "out:0.9,0.5:Output;in:0.1,0.5:Input" */
export declare function parsePorts(raw: unknown): GraphicPort[];
export declare function formatPorts(ports: GraphicPort[]): string;
export declare const DEFAULT_ELEC_PORTS = "in:0.08,0.5:In;out:0.92,0.5:Out";
export declare const DEFAULT_EQUIPMENT_PORTS = "in:0.5,0.05:Feed;out:0.5,0.95:Load";
/** Bus section with multiple tap points (Phase 13) */
export declare const DEFAULT_BUS_PORTS = "in:0.05,0.5:Feed;tap1:0.25,0.5:Tap1;tap2:0.5,0.5:Tap2;tap3:0.75,0.5:Tap3;out:0.95,0.5:Load";
export type WireEndpoint = {
    objectId: string;
    portId: string;
};
