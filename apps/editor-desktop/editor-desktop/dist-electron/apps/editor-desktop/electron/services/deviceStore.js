import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from '@energylink/shared-data';
let prisma = null;
function getClient() {
    process.env.DATABASE_URL = getDatabaseUrl();
    prisma ??= new PrismaClient();
    return prisma;
}
function isTransientSqliteError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return /timed out|timeout|database is locked|SQLITE_BUSY|failed to respond/i.test(message);
}
async function waitForRetry(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
async function withSqliteRetry(operation, attempts = 4) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (!isTransientSqliteError(error) || attempt === attempts)
                throw error;
            await waitForRetry(250 * attempt);
        }
    }
    throw lastError;
}
async function collectDeviceAndDescendantIds(client, rootId) {
    const ids = new Set([rootId]);
    let frontier = [rootId];
    while (frontier.length > 0) {
        const children = await client.device.findMany({ where: { parentDeviceId: { in: frontier } }, select: { id: true } });
        frontier = children.map(child => child.id).filter(id => !ids.has(id));
        for (const id of frontier)
            ids.add(id);
    }
    return Array.from(ids);
}
async function deleteDeviceGraph(client, rootId) {
    await client.$executeRawUnsafe('PRAGMA busy_timeout = 30000');
    const root = await client.device.findUnique({ where: { id: rootId }, select: { id: true } });
    if (!root)
        throw new Error('Device not found.');
    const deviceIds = await collectDeviceAndDescendantIds(client, rootId);
    await client.$transaction(async (tx) => {
        const tags = await tx.tag.findMany({ where: { deviceId: { in: deviceIds } }, select: { id: true } });
        const tagIds = tags.map(tag => tag.id);
        const alarms = await tx.alarm.findMany({
            where: { OR: [{ deviceId: { in: deviceIds } }, ...(tagIds.length ? [{ tagId: { in: tagIds } }] : [])] },
            select: { id: true }
        });
        const alarmIds = alarms.map(alarm => alarm.id);
        if (alarmIds.length)
            await tx.alarmNotificationEvent.deleteMany({ where: { alarmId: { in: alarmIds } } });
        await tx.historyValue.deleteMany({ where: { deviceId: { in: deviceIds } } });
        if (tagIds.length)
            await tx.historyValue.deleteMany({ where: { tagId: { in: tagIds } } });
        if (alarmIds.length)
            await tx.alarm.deleteMany({ where: { id: { in: alarmIds } } });
        await tx.tag.deleteMany({ where: { deviceId: { in: deviceIds } } });
        await tx.device.updateMany({ where: { id: { in: deviceIds } }, data: { parentDeviceId: null } });
        await tx.device.deleteMany({ where: { id: { in: deviceIds } } });
    }, { maxWait: 30000, timeout: 120000 });
}
function toDeviceSummary(device) {
    return {
        id: device.id,
        projectId: device.projectId,
        parentDeviceId: device.parentDeviceId,
        name: device.name,
        description: device.description,
        type: device.type,
        protocol: device.protocol,
        ipAddress: device.ipAddress,
        port: device.port,
        serialPort: device.serialPort,
        baudRate: device.baudRate,
        dataBits: device.dataBits,
        stopBits: device.stopBits,
        parity: device.parity,
        peripheralNumber: device.peripheralNumber,
        model: device.model,
        location: device.location,
        imageDataUrl: device.imageDataUrl ?? null,
        model3dUrl: device.model3dUrl ?? null,
        energyMappingJson: device.energyMappingJson ?? null,
        littleEndianData: Boolean(device.littleEndianData),
        swapRegisterBytes: Boolean(device.swapRegisterBytes),
        maxRegistersPerGroup: device.maxRegistersPerGroup,
        communicationEnabled: Boolean(device.communicationEnabled),
        historyEnabled: Boolean(device.historyEnabled),
        visible: Boolean(device.visible),
        pollingIntervalMs: device.pollingIntervalMs,
        timeoutMs: device.timeoutMs,
        status: device.status,
        lastTestAt: device.lastTestAt ? (device.lastTestAt instanceof Date ? device.lastTestAt.toISOString() : String(device.lastTestAt)) : null,
        lastError: device.lastError,
        createdAt: device.createdAt instanceof Date ? device.createdAt.toISOString() : String(device.createdAt),
        updatedAt: device.updatedAt instanceof Date ? device.updatedAt.toISOString() : String(device.updatedAt)
    };
}
async function getActiveProjectId(projectId) {
    if (projectId)
        return projectId;
    const client = getClient();
    const active = await client.appSetting.findUnique({ where: { key: 'activeProjectId' } });
    if (active?.value)
        return active.value;
    const project = await client.project.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!project)
        throw new Error('No active project. Create or open a project from the File menu first.');
    await client.appSetting.upsert({ where: { key: 'activeProjectId' }, update: { value: project.id }, create: { key: 'activeProjectId', value: project.id } });
    return project.id;
}
export async function listDevices(projectId) {
    const client = getClient();
    const activeProjectId = await getActiveProjectId(projectId);
    const devices = await client.device.findMany({ where: { projectId: activeProjectId }, orderBy: [{ type: 'asc' }, { name: 'asc' }] });
    return devices.map(toDeviceSummary);
}
export async function getDeviceTree(projectId) {
    const devices = await listDevices(projectId);
    const byId = new Map();
    for (const d of devices)
        byId.set(d.id, { ...d, children: [] });
    const roots = [];
    for (const node of byId.values()) {
        if (node.parentDeviceId && byId.has(node.parentDeviceId))
            byId.get(node.parentDeviceId).children.push(node);
        else
            roots.push(node);
    }
    return roots;
}
function assertDeviceInput(input) {
    if (!input.name?.trim())
        throw new Error('Device Name is required.');
    if (!input.type)
        throw new Error('Device Type is required.');
    if (input.type === 'converter' && input.parentDeviceId)
        throw new Error('Converter must be a first-level device only.');
    if ((input.type === 'meter' || input.type === 'sensor') && !input.parentDeviceId)
        throw new Error('Meter/Sensor must use a parent converter.');
}
function normalizeDeviceProtocol(protocol) {
    if (protocol === 'tcp' || protocol === 'udp' || protocol === 'modbus_tcp' || protocol === 'modbus_rtu' || protocol === 'cvm_c4' || protocol === 'cvm_c11' || protocol === 'xgmb_meter')
        return protocol;
    return 'modbus_tcp';
}
export async function createDevice(input) {
    assertDeviceInput(input);
    const client = getClient();
    const activeProjectId = await getActiveProjectId(input.projectId);
    let parent = null;
    if (input.parentDeviceId) {
        parent = await client.device.findFirst({ where: { id: input.parentDeviceId, projectId: activeProjectId } });
        if (!parent)
            throw new Error('Parent converter was not found in the current project.');
        if (parent.type !== 'converter')
            throw new Error('Parent device must be a converter.');
    }
    const protocol = normalizeDeviceProtocol(input.protocol ?? (input.type === 'converter' ? 'tcp' : 'modbus_tcp'));
    const device = await client.device.create({
        data: {
            projectId: activeProjectId,
            parentDeviceId: input.parentDeviceId || null,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            type: input.type,
            protocol,
            ipAddress: input.ipAddress?.trim() || null,
            port: input.port ?? (protocol === 'tcp' || protocol === 'udp' || protocol === 'modbus_tcp' ? 502 : null),
            serialPort: input.serialPort?.trim() || null,
            baudRate: input.baudRate ?? 9600,
            dataBits: input.dataBits ?? 8,
            stopBits: input.stopBits ?? 1,
            parity: input.parity ?? 'none',
            peripheralNumber: input.peripheralNumber ?? null,
            model: input.model?.trim() || null,
            location: input.location?.trim() || null,
            imageDataUrl: input.imageDataUrl?.trim() || null,
            // @ts-ignore
            model3dUrl: input.model3dUrl?.trim() || null,
            energyMappingJson: input.energyMappingJson?.trim() || null,
            littleEndianData: input.littleEndianData ?? false,
            swapRegisterBytes: input.swapRegisterBytes ?? false,
            maxRegistersPerGroup: input.maxRegistersPerGroup ?? 120,
            communicationEnabled: input.communicationEnabled ?? true,
            historyEnabled: input.historyEnabled ?? true,
            visible: input.visible ?? true,
            pollingIntervalMs: input.pollingIntervalMs ?? 1000,
            timeoutMs: input.timeoutMs ?? 2000,
            status: 'unknown'
        }
    });
    return toDeviceSummary(device);
}
export async function updateDevice(input) {
    const client = getClient();
    const { id, projectId: _projectId, ...rest } = input;
    const data = { ...rest };
    if ('name' in data && typeof data.name === 'string')
        data.name = data.name.trim();
    if ('description' in data && typeof data.description === 'string')
        data.description = data.description.trim() || null;
    if ('ipAddress' in data && typeof data.ipAddress === 'string')
        data.ipAddress = data.ipAddress.trim() || null;
    if ('serialPort' in data && typeof data.serialPort === 'string')
        data.serialPort = data.serialPort.trim() || null;
    if ('imageDataUrl' in data)
        data.imageDataUrl = typeof data.imageDataUrl === 'string' ? data.imageDataUrl.trim() || null : null;
    if ('model3dUrl' in data)
        data.model3dUrl = typeof data.model3dUrl === 'string' ? data.model3dUrl.trim() || null : null;
    if ('energyMappingJson' in data) {
        data.energyMappingJson = typeof data.energyMappingJson === 'string' ? data.energyMappingJson.trim() || null : null;
    }
    if ('parity' in data && typeof data.parity === 'string')
        data.parity = ['none', 'even', 'odd'].includes(data.parity) ? data.parity : 'none';
    const current = await client.device.findUnique({ where: { id } });
    if (current) {
        const nextType = data.type ?? current.type;
        const nextParentId = 'parentDeviceId' in data ? data.parentDeviceId : current.parentDeviceId;
        if (nextType === 'converter') {
            data.parentDeviceId = null;
            data.protocol = normalizeDeviceProtocol(data.protocol ?? current.protocol);
        }
        else if ((nextType === 'meter' || nextType === 'sensor') && nextParentId) {
            const parent = await client.device.findUnique({ where: { id: nextParentId } });
            if (parent?.type !== 'converter')
                throw new Error('Parent device must be a converter.');
            data.protocol = normalizeDeviceProtocol(data.protocol ?? current.protocol);
        }
        else if ('protocol' in data) {
            data.protocol = normalizeDeviceProtocol(data.protocol);
        }
    }
    const device = await withSqliteRetry(() => client.device.update({ where: { id }, data }));
    return toDeviceSummary(device);
}
export async function deleteDevice(id) {
    const client = getClient();
    await withSqliteRetry(() => deleteDeviceGraph(client, id));
    return true;
}
export async function getDeviceDatabaseStatus(projectId) {
    const client = getClient();
    const activeProjectId = await getActiveProjectId(projectId);
    const [deviceCount, converterCount, meterCount, sensorCount] = await Promise.all([
        client.device.count({ where: { projectId: activeProjectId } }),
        client.device.count({ where: { projectId: activeProjectId, type: 'converter' } }),
        client.device.count({ where: { projectId: activeProjectId, type: 'meter' } }),
        client.device.count({ where: { projectId: activeProjectId, type: 'sensor' } })
    ]);
    return { activeProjectId, deviceCount, converterCount, meterCount, sensorCount };
}
export async function disconnectDeviceStore() {
    if (prisma)
        await prisma.$disconnect();
    prisma = null;
}
