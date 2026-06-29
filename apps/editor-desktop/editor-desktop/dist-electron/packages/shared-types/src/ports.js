/** Connection ports + wire bindings (Phase 10) */
/** Parse "out:0.9,0.5:Output;in:0.1,0.5:Input" */
export function parsePorts(raw) {
    if (typeof raw !== 'string' || !raw.trim())
        return [];
    const ports = [];
    for (const part of raw.split(';')) {
        const trimmed = part.trim();
        if (!trimmed)
            continue;
        const [idPart, coords, ...labelParts] = trimmed.split(':');
        if (!idPart || !coords)
            continue;
        const [xs, ys] = coords.split(',').map((s) => s.trim());
        const x = Number(xs);
        const y = Number(ys);
        if (!Number.isFinite(x) || !Number.isFinite(y))
            continue;
        const portId = idPart.trim();
        const kind = portId.startsWith('in') ? 'in' : portId.startsWith('out') ? 'out' : 'bidirectional';
        ports.push({
            id: portId,
            x: Math.min(1, Math.max(0, x)),
            y: Math.min(1, Math.max(0, y)),
            label: labelParts.join(':').trim() || undefined,
            kind,
        });
    }
    return ports;
}
export function formatPorts(ports) {
    return ports
        .map((p) => {
        const label = p.label ? `:${p.label}` : '';
        return `${p.id}:${p.x.toFixed(3)},${p.y.toFixed(3)}${label}`;
    })
        .join(';');
}
export const DEFAULT_ELEC_PORTS = 'in:0.08,0.5:In;out:0.92,0.5:Out';
export const DEFAULT_EQUIPMENT_PORTS = 'in:0.5,0.05:Feed;out:0.5,0.95:Load';
/** Bus section with multiple tap points (Phase 13) */
export const DEFAULT_BUS_PORTS = 'in:0.05,0.5:Feed;tap1:0.25,0.5:Tap1;tap2:0.5,0.5:Tap2;tap3:0.75,0.5:Tap3;out:0.95,0.5:Load';
