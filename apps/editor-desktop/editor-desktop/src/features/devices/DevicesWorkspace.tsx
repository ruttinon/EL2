import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useModal } from '../../context/ModalContext';
import type {
  CreateDeviceInput,
  CreateTagInput,
  DeviceDatabaseStatus,
  DeviceSummary,
  DeviceTreeNode,
  DeviceType,
  TagDatabaseStatus,
  TagDataType,
  TagRegisterType,
  TagSummary
} from '@energylink/shared-types';
import { EDITOR_COMMAND_EVENT, normalizeCommand, type EditorCommand } from '../../commandBus';
import { getEngineUrl } from '@energylink/shared-ui';
import { TemplatesWorkspace } from '../templates/TemplatesWorkspace';
import { DeviceEnergyMappingCard, DeviceEnergyMappingSummary } from './DeviceEnergyMappingCard';
import type { DeviceEnergyMapping } from '@energylink/shared-types';
import {
  defaultDeviceEnergyMapping,
  resolveDeviceEnergyMapping,
  serializeDeviceEnergyMapping,
  stripLegacyBlockFromDescription,
  inferTagEnergyRole,
  TAG_ENERGY_ROLE_OPTIONS,
  suggestPrimaryImportTagName,
} from '@energylink/shared-types';
import { importModelFileToAsset } from '../graphics/graphicAssets';

type DeviceMode = 'converter' | 'meter' | 'sensor';
type ActiveTab = 'devices' | 'tags' | 'details' | 'templates';
type ViewMode = 'connections' | 'groups' | 'devices';
type DialogMode = 'none' | 'device' | 'tag' | 'import_template';

const DEVICES_WORKSPACE_CACHE_TTL_MS = 60_000;

type DevicesWorkspaceCache = {
  savedAt: number;
  activeProject: { id: string; name: string } | null;
  devices: DeviceSummary[];
  tree: DeviceTreeNode[];
  deviceStatus: DeviceDatabaseStatus | null;
  tagStatus: TagDatabaseStatus | null;
  tags: TagSummary[];
  templates: any[];
  selectedId?: string;
  selectedTagId?: string;
  expandedIds: string[];
  activeTab: ActiveTab;
  viewMode: ViewMode;
};

let devicesWorkspaceCache: DevicesWorkspaceCache | null = null;

function isDevicesWorkspaceCacheFresh() {
  return Boolean(devicesWorkspaceCache && Date.now() - devicesWorkspaceCache.savedAt < DEVICES_WORKSPACE_CACHE_TTL_MS);
}

const defaultConverter: CreateDeviceInput = {
  name: '',
  description: '',
  type: 'converter',
  protocol: 'tcp',
  ipAddress: '',
  port: 502,
  peripheralNumber: 1,
  model: '',
  location: '',
  littleEndianData: false,
  swapRegisterBytes: false,
  maxRegistersPerGroup: 120,
  communicationEnabled: true,
  historyEnabled: true,
  visible: true,
  pollingIntervalMs: 1000,
  timeoutMs: 2000,
  imageDataUrl: '',
  model3dUrl: ''
};

const defaultMeter: CreateDeviceInput = {
  name: '',
  description: '',
  type: 'meter',
  protocol: 'modbus_tcp',
  serialPort: '',
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  peripheralNumber: 1,
  model: '',
  location: '',
  littleEndianData: false,
  swapRegisterBytes: false,
  maxRegistersPerGroup: 120,
  communicationEnabled: true,
  historyEnabled: true,
  visible: true,
  pollingIntervalMs: 1000,
  timeoutMs: 2000,
  imageDataUrl: '',
  model3dUrl: ''
};

const defaultTag: CreateTagInput = {
  deviceId: '',
  name: '',
  description: '',
  mqttTopic: '',
  address: 0,
  registerType: 'holding_register',
  dataType: 'float32',
  unit: '',
  scale: 1,
  offset: 0,
  decimalPlaces: 2,
  historyEnabled: true,
  alarmHigh: null,
  alarmLow: null,
  energyTagRole: 'none',
};

function deviceIcon(type: DeviceType, size = 18, color?: string) {
  if (type === 'converter') return <Icon icon="solar:round-transfer-horizontal-bold-duotone" width={size} height={size} style={{ color: color || '#10b981' }} />;
  return <Icon icon="solar:bolt-bold-duotone" width={size} height={size} style={{ color: color || '#f59e0b' }} />;
}

function resolveDeviceImage(device: Pick<DeviceSummary, 'type' | 'name' | 'model' | 'imageDataUrl' | 'protocol'>, templateList: any[]) {
  if (device.imageDataUrl) return device.imageDataUrl;
  if (device.type === 'meter' || device.type === 'sensor') {
    const match = findTemplateForDevice(device as DeviceSummary, templateList);
    return match ? templateImage(match) : '';
  }
  return '';
}

function DeviceNodeIcon({
  device,
  templates,
  size = 18,
  color,
}: {
  device: Pick<DeviceSummary, 'type' | 'name' | 'model' | 'imageDataUrl' | 'protocol'>;
  templates: any[];
  size?: number;
  color?: string;
}) {
  const src = resolveDeviceImage(device, templates);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="device-tree-thumb"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: 4,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
          flexShrink: 0,
        }}
      />
    );
  }
  return deviceIcon(device.type, size, color);
}

function toNumber(value: string, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, '_');
}

function normalizeDeviceProtocol(protocol?: string | null) {
  if (protocol === 'tcp' || protocol === 'udp' || protocol === 'modbus_tcp' || protocol === 'modbus_rtu' || protocol === 'cvm_c4' || protocol === 'cvm_c11' || protocol === 'xgmb_meter' || protocol === 'mqtt') return protocol;
  return 'modbus_tcp';
}

function converterProtocolLabel(protocol?: string | null) {
  if (protocol === 'tcp') return 'TCP';
  if (protocol === 'udp') return 'UDP';
  if (protocol === 'modbus_tcp') return 'Modbus TCP';
  if (protocol === 'modbus_rtu') return 'Modbus RTU';
  if (protocol === 'mqtt') return 'MQTT Broker';
  return protocol || '-';
}

function meterDriverLabel(protocol?: string | null, model?: string | null) {
  if (protocol === 'cvm_c4') return 'CVM-C4';
  if (protocol === 'cvm_c11') return 'CVM-C11';
  if (protocol === 'xgmb_meter') return model ? `XGMB · ${model}` : 'Imported XGMB Meter';
  if (protocol === 'modbus_tcp') return 'Modbus TCP (select a meter driver)';
  if (protocol === 'modbus_rtu') return 'Modbus RTU (select a meter driver)';
  return protocol ? `Unknown meter driver (${protocol})` : '-';
}

function findTemplateForDevice(device: DeviceSummary, templateList: any[]) {
  const modelKey = normalizeMeterKey(device.model || device.name);
  const byModel = templateList.find(t => {
    const key = normalizeMeterKey(templateModel(t));
    return key && modelKey && key === modelKey;
  }) ?? templateList.find(t => t.name === device.model || t.name === device.name);
  if (byModel) return byModel;

  const protocol = normalizeDeviceProtocol(device.protocol);
  if (protocol === 'cvm_c11' || protocol === 'cvm_c4' || protocol === 'xgmb_meter') {
    return templateList.find(t => {
      const driverKey = String(t.driverKey || t.metadata?.driverKey || t.protocol || '').toLowerCase();
      return driverKey === protocol;
    });
  }
  return undefined;
}

function registerLengthForDataType(dataType?: string) {
  if (dataType === 'int32' || dataType === 'uint32' || dataType === 'float32') return 2;
  if (dataType === 'float64') return 4;
  return 1;
}

function scaleFromDecimals(decimals?: number) {
  const value = Number(decimals);
  if (!Number.isInteger(value) || value <= 0) return 1;
  return 1 / Math.pow(10, Math.min(value, 12));
}

function isMeterTemplate(template: any) {
  const category = String(template?.category || '').toLowerCase();
  const metadataCategory = String(template?.metadata?.category || template?.deviceType || '').toLowerCase();
  return !/converter|gateway|communication|protocol|tcp|udp|rtu/.test(category)
    && !/converter|gateway|communication/.test(metadataCategory);
}

const BUILT_IN_METER_DRIVERS = [
  { value: 'cvm_c4', label: 'CVM-C4', desc: 'CIRCUTOR CVM-C4 meter driver', icon: 'solar:bolt-bold-duotone', vendor: 'CIRCUTOR' },
  { value: 'cvm_c11', label: 'CVM-C11', desc: 'CIRCUTOR CVM-C11 meter driver', icon: 'solar:bolt-bold-duotone', vendor: 'CIRCUTOR' }
];

function isUnknownVendor(value?: string | null) {
  const v = String(value || '').trim().toLowerCase();
  return !v || v === 'unknown' || v === 'undefined' || v === 'null';
}


const KNOWN_METER_VENDORS = [
  'CIRCUTOR',
  'Socomec',
  'Janitza',
  'Schneider Electric',
  'ABB',
  'Siemens',
  'Carlo Gavazzi',
  'Lovato',
  'Eastron',
  'Acrel'
];

function normalizeVendorName(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const known = KNOWN_METER_VENDORS.find(v => v.toLowerCase() === raw.toLowerCase());
  return known || raw;
}

function isLikelyMeterModelValue(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^(CVM|CEM|CIRWATT|DHB|DHH|DHC|TR|EDMK|STM)/.test(key)) return true;
  if (/^(DIRIS|COUNTIS|PM|ION|PAC|SENTRON|EM|SDM|ACR)[A-Z0-9]+/.test(key)) return true;
  if (/\d/.test(raw) && /[-_]/.test(raw)) return true;
  return false;
}

function isValidVendorName(value?: string | null) {
  const raw = String(value || '').trim();
  if (isUnknownVendor(raw)) return false;
  if (isLikelyMeterModelValue(raw)) return false;
  return /^[A-Za-z][A-Za-z0-9 .&+/-]{1,40}$/.test(raw);
}

function inferMeterModelName(value?: string | null) {
  const raw = String(value || '').trim().replace(/\.(xgmb|json)$/i, '');
  if (!raw) return 'Imported Meter';

  const normalized = raw.replace(/[ _]+/g, '-').toUpperCase();
  const patterns = [
    /CVM-?B?100/,
    /CVM-?C11/,
    /CVM-?C4/,
    /CVM-?C5/,
    /CVM-?C10/,
    /CVM-?B150/,
    /CVM-?1D/,
    /CVM-?MINI/,
    /CEM-?[A-Z0-9-]+/,
    /CIRWATT-?[A-Z0-9-]+/,
    /DH[BH]-?[0-9A-Z-]+/,
    /DHC-?[0-9A-Z-]+/,
    /TR[0-9]+/,
    /EDMK/,
    /STM/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[0]) return match[0].replace(/CVM-?B100/, 'CVMB100').replace(/CVM-?C11/, 'CVM-C11').replace(/CVM-?C4/, 'CVM-C4');
  }

  return raw;
}

function normalizeMeterKey(value?: string | null) {
  return inferMeterModelName(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function inferMeterVendorFromModel(model?: string | null) {
  const key = normalizeMeterKey(model);
  if (/^(CVM|CEM|CIRWATT|DHB|DHH|DHC|TR|EDMK|STM)/.test(key)) return 'CIRCUTOR';
  if (/^(DIRIS|COUNTIS)/.test(key)) return 'Socomec';
  if (/^A\d{1,2}$/.test(key)) return 'Socomec';
  if (/^(UMG|JANITZA)/.test(key)) return 'Janitza';
  if (/^(PM|ION|POWERLOGIC)/.test(key)) return 'Schneider Electric';
  if (/^(SENTRON|PAC)/.test(key)) return 'Siemens';
  if (/^(M2M|ABB)/.test(key)) return 'ABB';
  return 'Unknown';
}

function templateModel(template: any) {
  return inferMeterModelName(template?.model || template?.metadata?.model || template?.name || 'Imported Meter');
}

function templateVendor(template: any) {
  const rawVendor = normalizeVendorName(template?.vendor || template?.metadata?.vendor || template?.metadata?.brand || '');
  if (isValidVendorName(rawVendor)) return rawVendor;
  const inferred = inferMeterVendorFromModel(templateModel(template));
  return isValidVendorName(inferred) ? inferred : 'Other';
}

function templateImage(template: any) {
  return template?.imageDataUrl || template?.deviceImage || template?.metadata?.imageDataUrl || template?.metadata?.deviceImage || '';
}

function templateRank(template: any) {
  let rank = 0;
  if (isValidVendorName(template?.vendor || template?.metadata?.vendor || template?.metadata?.brand)) rank += 10;
  if (templateImage(template)) rank += 5;
  if (template?.type === 'user' || template?.metadata?.source === 'xgmb_import') rank += 3;
  return rank;
}

export function DevicesWorkspace() {
  const { showConfirm } = useModal();
  const [activeProject, setActiveProject] = useState<{ id: string; name: string } | null>(null);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [tree, setTree] = useState<DeviceTreeNode[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<DeviceDatabaseStatus | null>(null);
  const [tagStatus, setTagStatus] = useState<TagDatabaseStatus | null>(null);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>();

  // UI States
  const [activeTab, setActiveTab] = useState<ActiveTab>('devices');
  const [viewMode, setViewMode] = useState<ViewMode>('connections');
  const [dialogMode, setDialogMode] = useState<DialogMode>('none');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('converter');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form States
  const [deviceForm, setDeviceForm] = useState<CreateDeviceInput>({ ...defaultConverter });
  const [deviceWizardStep, setDeviceWizardStep] = useState<'driver' | 'details'>('details');
  const [energyMapping, setEnergyMapping] = useState<DeviceEnergyMapping>(() => defaultDeviceEnergyMapping());
  const [energyAdvancedOpen, setEnergyAdvancedOpen] = useState(false);
  const [tagForm, setTagForm] = useState<CreateTagInput>({ ...defaultTag });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [deviceTags, setDeviceTags] = useState<any[]>([]);
  const [tagsDirty, setTagsDirty] = useState(false);
  const [carbonAsMainMeter, setCarbonAsMainMeter] = useState(false);
  const [carbonPrimaryTagName, setCarbonPrimaryTagName] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Import Template States
  const [importForm, setImportForm] = useState({
    filePath: '',
    fileContent: '',
    category: 'Power Meter',
    vendor: '',
    templateName: '',
    imageDataUrl: ''
  });
  const [importPreview, setImportPreview] = useState<any>(null);
  const fileInputRef = useMemo(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xgmb';
    return input;
  }, []);
  const imageInputRef = useMemo(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    return input;
  }, []);
  const model3dInputRef = useMemo(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf,model/gltf-binary,model/gltf+json';
    return input;
  }, []);

  const [templates, setTemplates] = useState<any[]>([]);
  const selected = useMemo(() => devices.find(d => d.id === selectedId), [devices, selectedId]);
  const converters = useMemo(() => devices.filter(d => d.type === 'converter'), [devices]);
  const meterTemplates = useMemo(() => templates.filter(isMeterTemplate), [templates]);
  const uniqueMeterTemplates = useMemo(() => {
    const byModel = new Map<string, any>();
    for (const template of meterTemplates) {
      const key = normalizeMeterKey(templateModel(template));
      if (!key) continue;
      const existing = byModel.get(key);
      if (!existing || templateRank(template) > templateRank(existing)) {
        byModel.set(key, template);
      }
    }
    return Array.from(byModel.values()).sort((a, b) => templateModel(a).localeCompare(templateModel(b)));
  }, [meterTemplates]);
  const importedMeterTemplateKeys = useMemo(() => new Set(uniqueMeterTemplates.map(t => normalizeMeterKey(templateModel(t)))), [uniqueMeterTemplates]);
  const visibleBuiltInMeterDrivers = useMemo(() => {
    return BUILT_IN_METER_DRIVERS.filter(item => !importedMeterTemplateKeys.has(normalizeMeterKey(item.label)));
  }, [importedMeterTemplateKeys]);
  const meterTemplatesByVendor = useMemo(() => {
    return uniqueMeterTemplates.reduce<Record<string, any[]>>((groups, template) => {
      const vendor = templateVendor(template);
      groups[vendor] = groups[vendor] || [];
      groups[vendor].push(template);
      return groups;
    }, {});
  }, [uniqueMeterTemplates]);
  const selectedTag = useMemo(() => tags.find(t => t.id === selectedTagId), [tags, selectedTagId]);
  const activeParentProtocol = protocolFromParent(deviceForm.parentDeviceId);
  const [isNewImportCategory, setIsNewImportCategory] = useState(false);
  const [isNewImportVendor, setIsNewImportVendor] = useState(false);

  const existingCategories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [templates]);

  const existingVendors = useMemo(() => {
    const vends = new Set<string>(KNOWN_METER_VENDORS);
    for (const template of templates) {
      const vendor = templateVendor(template);
      if (isValidVendorName(vendor)) vends.add(vendor);
    }
    return Array.from(vends).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  function protocolFromParent(parentDeviceId?: string | null) {
    const parent = devices.find(d => d.id === parentDeviceId && d.type === 'converter');
    return normalizeDeviceProtocol(parent?.protocol);
  }

  function applyDevicesCache(cache: DevicesWorkspaceCache) {
    setActiveProject(cache.activeProject);
    setDevices(cache.devices);
    setTree(cache.tree);
    setDeviceStatus(cache.deviceStatus);
    setTagStatus(cache.tagStatus);
    setTags(cache.tags);
    setTemplates(cache.templates);
    setSelectedId(cache.selectedId);
    setSelectedTagId(cache.selectedTagId);
    setExpandedIds(new Set(cache.expandedIds));
    setActiveTab(cache.activeTab);
    setViewMode(cache.viewMode);
    setError('');
  }

  async function refresh(keepSelected = true) {
    try {
      const [deviceList, deviceTree, deviceDbStatus, tagList, tagDbStatus, projectList, templateList] = await Promise.all([
        window.energylink.devices.list(),
        window.energylink.devices.tree(),
        window.energylink.devices.status(),
        window.energylink.tags.list(),
        window.energylink.tags.status(),
        window.energylink.projects.list().catch(() => []),
        fetch(`${getEngineUrl()}/api/templates`).then(r => r.json()).then(d => d.templates).catch(() => [])
      ]);

      let nextActiveProject: { id: string; name: string } | null = activeProject;
      const pid = deviceDbStatus?.activeProjectId;
      if (pid) {
        const proj = projectList.find((p: any) => p.id === pid);
        nextActiveProject = proj ? { id: proj.id, name: proj.name } : null;
      } else {
        nextActiveProject = null;
      }

      const nextExpandedIds = keepSelected ? expandedIds : new Set(deviceList.map(d => d.id));

      setDevices(deviceList);
      setTree(deviceTree);
      setDeviceStatus(deviceDbStatus);
      setTags(tagList);
      setTagStatus(tagDbStatus);
      setTemplates(templateList);
      setActiveProject(nextActiveProject);

      if (!keepSelected) {
        setExpandedIds(nextExpandedIds);
      }

      devicesWorkspaceCache = {
        savedAt: Date.now(),
        activeProject: nextActiveProject,
        devices: deviceList,
        tree: deviceTree,
        deviceStatus: deviceDbStatus,
        tagStatus: tagDbStatus,
        tags: tagList,
        templates: templateList,
        selectedId,
        selectedTagId,
        expandedIds: Array.from(nextExpandedIds),
        activeTab,
        viewMode
      };

      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleImportXgmb() {
    try {
      fileInputRef.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const content = event.target?.result as string;

          // Initial parse for preview using content
          const res = await fetch(`${getEngineUrl()}/api/templates/import-xgmb`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileContent: content, templateName: file.name.replace('.xgmb', ''), previewOnly: true })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          const baseName = data.fileName || file.name.replace(/\.xgmb$/i, '');
          const importedCategory = 'Power Meter';
          const importedModel = inferMeterModelName(data.config?.model || data.config?.name || baseName);
          const parsedVendor = normalizeVendorName(data.config?.vendor || data.config?.metadata?.vendor || data.config?.metadata?.brand || '');
          const inferredVendor = inferMeterVendorFromModel(importedModel);
          const importedVendor = isValidVendorName(parsedVendor)
            ? parsedVendor
            : (isValidVendorName(inferredVendor) ? inferredVendor : '');
          setImportForm({
            filePath: '', // No path needed when using content
            fileContent: content,
            category: importedCategory,
            vendor: importedVendor,
            templateName: importedModel,
            imageDataUrl: ''
          });
          setIsNewImportCategory(!existingCategories.includes(importedCategory));
          setIsNewImportVendor(!importedVendor || !existingVendors.includes(importedVendor));
          setImportPreview(data.config);
          setDialogMode('import_template');
        };
        reader.readAsText(file);
      };
      fileInputRef.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleImportDeviceImage() {
    imageInputRef.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file for the device.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportForm(prev => ({ ...prev, imageDataUrl: String(event.target?.result || '') }));
      };
      reader.readAsDataURL(file);
    };
    imageInputRef.click();
  }

  function handleDeviceImage() {
    imageInputRef.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file for the device.');
        return;
      }
      if (file.size > 512 * 1024) {
        setError('Device image must be 512KB or smaller.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setDeviceForm(prev => ({ ...prev, imageDataUrl: String(event.target?.result || '') }));
        setError('');
      };
      reader.readAsDataURL(file);
      imageInputRef.value = '';
    };
    imageInputRef.click();
  }

  function handleDeviceModel3d() {
    model3dInputRef.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
        setError('Please select a .glb or .gltf file.');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError('3D model must be 8MB or smaller.');
        return;
      }
      try {
        const { ref } = await importModelFileToAsset(file);
        setDeviceForm((prev) => ({ ...prev, model3dUrl: ref }));
        setError('');
        setMessage(`3D model "${file.name}" imported to Asset Library.`);
      } catch {
        setError('Failed to import 3D model.');
      }
      model3dInputRef.value = '';
    };
    model3dInputRef.click();
  }

  async function applyTemplateAsMeterDriver(template: any) {
    setSelectedTemplateId(template.id);
    setDeviceForm(prev => ({
      ...prev,
      type: 'meter',
      protocol: String(template.protocol || template.driverKey || template.metadata?.driverKey || 'xgmb_meter') as any,
      model: templateModel(template),
      name: prev.name || normalizeName(templateModel(template))
    }));
    await handleTemplateChange(template.id);
  }

  async function confirmImportTemplate() {
    try {
      const res = await fetch(`${getEngineUrl()}/api/templates/import-xgmb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importForm)
      });
      if (!res.ok) throw new Error('Failed to save template');

      setMessage(`Template "${importForm.templateName}" saved successfully.`);
      const savedVendor = isValidVendorName(importForm.vendor) ? normalizeVendorName(importForm.vendor) : inferMeterVendorFromModel(importForm.templateName);
      const savedTemplateName = inferMeterModelName(importForm.templateName);
      const savedTemplateId = `user:${importForm.category || 'Power Meter'}:${savedVendor || 'Unknown'}:${savedTemplateName}.json`;
      await refresh(true);
      setDeviceMode('meter');
      setDeviceWizardStep('driver');
      setDialogMode('device');
      setSelectedTemplateId(savedTemplateId);
      setDeviceForm(prev => ({
        ...prev,
        type: 'meter',
        protocol: 'xgmb_meter' as any,
        model: importForm.templateName,
        name: prev.name || normalizeName(importForm.templateName)
      }));
      await handleTemplateChange(savedTemplateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (isDevicesWorkspaceCacheFresh() && devicesWorkspaceCache) {
      applyDevicesCache(devicesWorkspaceCache);
    } else {
      void refresh(false);
    }

    const handleProjectChange = () => {
      devicesWorkspaceCache = null;
      void refresh(false);
    };
    window.addEventListener('energylink:active-project-changed', handleProjectChange);
    return () => window.removeEventListener('energylink:active-project-changed', handleProjectChange);
  }, []);

  useEffect(() => {
    if (!devicesWorkspaceCache) return;
    devicesWorkspaceCache = {
      ...devicesWorkspaceCache,
      savedAt: Date.now(),
      selectedId,
      selectedTagId,
      expandedIds: Array.from(expandedIds),
      activeTab,
      viewMode
    };
  }, [selectedId, selectedTagId, expandedIds, activeTab, viewMode]);

  // Dialog Handlers
  function openAddDevice(mode: DeviceMode) {
    setDeviceMode(mode);
    setEnergyMapping(defaultDeviceEnergyMapping(mode));
    setEnergyAdvancedOpen(false);
    if (mode === 'converter') {
      setDeviceForm({ ...defaultConverter });
      setDeviceWizardStep('details');
    } else {
      setDeviceForm({ ...defaultMeter, parentDeviceId: null, protocol: '' as any, model: '', name: '' });
      setDeviceWizardStep('driver');
    }
    setSelectedTemplateId('');
    setDeviceTags([]);
    setTagsDirty(false);
    setCarbonAsMainMeter(false);
    setCarbonPrimaryTagName('');
    setIsEditing(false);
    setDialogMode('device');
  }

  async function openEditDevice(device: DeviceSummary) {
    setDeviceMode(device.type);
    const parentDeviceId = device.parentDeviceId ?? null;
    const match = device.type === 'meter' ? findTemplateForDevice(device, templates) : undefined;
    let protocol = normalizeDeviceProtocol(device.protocol);
    if (device.type === 'meter' && match) {
      protocol = normalizeDeviceProtocol(
        String(match.driverKey || match.metadata?.driverKey || match.protocol || protocol)
      );
    }
    const imageDataUrl = device.imageDataUrl || (match ? templateImage(match) : '') || '';
    const plainDescription = stripLegacyBlockFromDescription(device.description);
    setEnergyMapping(resolveDeviceEnergyMapping(device));
    setEnergyAdvancedOpen(Boolean(resolveDeviceEnergyMapping(device).advanced));
    setCarbonAsMainMeter(resolveDeviceEnergyMapping(device).role === 'site_main');
    setDeviceForm({
      ...device,
      description: plainDescription,
      parentDeviceId,
      protocol,
      imageDataUrl,
      model3dUrl: device.model3dUrl ?? '',
      model: device.model || (match ? templateModel(match) : device.model)
    });
    setDeviceWizardStep('details');
    setSelectedTemplateId(match?.id ?? '');
    setTagsDirty(false);

    // Fetch current tags for this device
    try {
      const tagList = await window.energylink.tags.list();
      const tagsForDevice = tagList.filter((t: any) => t.deviceId === device.id);
      setDeviceTags(tagsForDevice);
      const importTag = tagsForDevice.find((t: any) => t.energyTagRole === 'import_kwh' || t.energyTagRole === 'net_kwh');
      setCarbonPrimaryTagName(importTag?.name ?? suggestPrimaryImportTagName(tagsForDevice));
    } catch (e) {
      setDeviceTags([]);
    }

    setIsEditing(true);
    setDialogMode('device');
  }

  async function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setDeviceTags([]);
      setTagsDirty(false);
      return;
    }

    setLoadingTemplate(true);
    setError('');
    try {
      const res = await fetch(`${getEngineUrl()}/api/templates/detail?id=${encodeURIComponent(templateId)}`);
      if (!res.ok) throw new Error('Failed to fetch template details');
      const template = await res.json();

      setDeviceForm(prev => ({
        ...prev,
        protocol: String(template.driverKey || template.metadata?.driverKey || prev.protocol || 'xgmb_meter') as any,
        model: template.model || template.name || template.metadata?.model || prev.model,
        imageDataUrl: templateImage(template) || prev.imageDataUrl || '',
        littleEndianData: template.littleEndianData ?? prev.littleEndianData,
        swapRegisterBytes: template.swapRegisterBytes ?? prev.swapRegisterBytes,
        maxRegistersPerGroup: template.maxRegisters ?? prev.maxRegistersPerGroup,
      }));

      // If template has variables, map them to deviceTags
      if (template.variables) {
        const mappedTags = template.variables.map((v: any) => {
          const dataType = v.dataType || 'float32';
          const decimalPlaces = Number(v.decimals ?? v.decimalPlaces ?? 2);
          const unit = v.units || '';
          const name = v.name;
          return {
            name,
            description: v.description,
            address: v.initAddress,
            registers: Math.max(Number(v.registers || 1), registerLengthForDataType(dataType)),
            functionCode: v.functionCode || 3,
            functionWriteCode: v.functionWriteCode || 16,
            dataType,
            unit,
            scale: Number(v.scale ?? scaleFromDecimals(decimalPlaces)),
            decimalPlaces,
            energyTagRole: inferTagEnergyRole(name, unit),
            type: v.type || 'NUMERIC'
          };
        });
        setDeviceTags(mappedTags);
        setTagsDirty(true);
        setCarbonPrimaryTagName(suggestPrimaryImportTagName(mappedTags));
        setMessage(`Loaded ${mappedTags.length} tags from template "${template.name}"`);
      }
    } catch (err) {
      console.error('Failed to load template details:', err);
      setError('Could not load template details. Please check if Engine is running.');
    } finally {
      setLoadingTemplate(false);
    }
  }

  function openAddTag() {
    setTagForm({ ...defaultTag, deviceId: selectedId ?? '' });
    setIsEditing(false);
    setDialogMode('tag');
  }

  function openEditTag(tag: TagSummary) {
    setTagForm({ ...tag });
    setIsEditing(true);
    setDialogMode('tag');
  }

  // Action Handlers
  async function handleSaveDevice() {
    const pid = deviceStatus?.activeProjectId || activeProject?.id;
    if (!pid) return setError('No active project found.');

    try {
      const mapping =
        deviceMode === 'meter' && carbonAsMainMeter
          ? { ...energyMapping, role: 'site_main' as const, includeInCarbon: true }
          : energyMapping;

      const payload: Record<string, unknown> = {
        ...deviceForm,
        projectId: pid,
        name: normalizeName(deviceForm.name),
        description: stripLegacyBlockFromDescription(deviceForm.description),
        energyMappingJson: serializeDeviceEnergyMapping(mapping),
      };

      if (!isEditing || tagsDirty) {
        payload.tags = deviceTags.map((t: any) => {
          const inferred = inferTagEnergyRole(t.name, t.unit);
          const energyTagRole =
            carbonPrimaryTagName && t.name === carbonPrimaryTagName
              ? 'import_kwh'
              : t.energyTagRole && t.energyTagRole !== 'none'
                ? t.energyTagRole
                : inferred;
          return { ...t, energyTagRole };
        });
      }

      // Ensure numeric types for API
      if (payload.port) payload.port = Number(payload.port);
      if (payload.peripheralNumber) payload.peripheralNumber = Number(payload.peripheralNumber);
      if (payload.pollingIntervalMs) payload.pollingIntervalMs = Number(payload.pollingIntervalMs);
      if (payload.timeoutMs) payload.timeoutMs = Number(payload.timeoutMs);

      // Safety check for parentDeviceId
      if (payload.type === 'meter' && !payload.parentDeviceId) {
        return setError('Please select a Parent Converter for the Meter.');
      }
      if (payload.type === 'converter') {
        payload.parentDeviceId = null;
        payload.protocol = normalizeDeviceProtocol(String(payload.protocol ?? ''));
      } else if (payload.type === 'meter' || payload.type === 'sensor') {
        payload.protocol = normalizeDeviceProtocol(String(payload.protocol ?? ''));
      }

      if (isEditing && selectedId) {
        await window.energylink.devices.update({ ...payload, id: selectedId });
        // Tags update is still separate for now or could be handled in backend
        setMessage(`Device updated: ${deviceForm.name}`);
      } else {
        const created = await window.energylink.devices.create(payload);
        setSelectedId(created.id);
        setMessage(`Device created: ${created.name}`);
      }
      setDialogMode('none');
      await refresh(true);
    } catch (err) {
      // Enhanced error message
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[DevicesWorkspace] handleSaveDevice error:', err);
      if (err instanceof Error && (err as any).errors) {
        console.error('[DevicesWorkspace] validation errors:', (err as any).errors);
      }
    }
  }

  async function handleSaveTag() {
    const pid = deviceStatus?.activeProjectId || activeProject?.id;
    if (!pid) return setError('No active project found.');

    try {
      if (isEditing && selectedTagId) {
        await window.energylink.tags.update({ ...tagForm, id: selectedTagId, name: normalizeName(tagForm.name) });
        setMessage(`Tag updated: ${tagForm.name}`);
      } else {
        const created = await window.energylink.tags.create({ ...tagForm, projectId: pid, name: normalizeName(tagForm.name) });
        setSelectedTagId(created.id);
        setMessage(`Tag created: ${created.name}`);
      }
      setDialogMode('none');
      await refresh(true);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function handleDeleteDevice(id: string, name: string) {
    if (!await showConfirm(`Delete device ${name}?`)) return;
    try {
      await window.energylink.devices.delete(id);
      if (selectedId === id) setSelectedId(undefined);
      await refresh(false);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function handleDeleteTag(id: string, name: string) {
    if (!await showConfirm(`Delete tag ${name}?`)) return;
    try {
      await window.energylink.tags.delete(id);
      await refresh(true);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  // Ribbon Command Integration
  useEffect(() => {
    const onCommand = (e: Event) => {
      const detail = (e as CustomEvent<EditorCommand>).detail;
      if (detail.module !== 'devices') return;
      const cmd = normalizeCommand(detail.item);

      if (cmd === 'add converter') openAddDevice('converter');
      else if (cmd === 'add meter') openAddDevice('meter');
      else if (cmd === 'add tag') openAddTag();
      else if (cmd === 'connections') { setViewMode('connections'); setActiveTab('devices'); }
      else if (cmd === 'groups') { setViewMode('groups'); setActiveTab('devices'); }
      else if (cmd === 'devices') { setViewMode('devices'); setActiveTab('devices'); }
      else if (cmd === 'templates') setActiveTab('templates');
      else if (cmd === 'tag list') setActiveTab('tags');
      else if (cmd === 'expand') setExpandedIds(new Set(devices.map(d => d.id)));
      else if (cmd === 'collapse') setExpandedIds(new Set());
      else if (cmd === 'modify') {
        if (activeTab === 'tags' && selectedTag) openEditTag(selectedTag);
        else if (selected) openEditDevice(selected);
      }
      else if (cmd === 'delete') {
        if (activeTab === 'tags' && selectedTag) handleDeleteTag(selectedTag.id, selectedTag.name);
        else if (selected) handleDeleteDevice(selected.id, selected.name);
      }
      else if (cmd === 'refresh') void refresh(true);
      else if (cmd === 'import config') handleImportXgmb();
    };
    window.addEventListener(EDITOR_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(EDITOR_COMMAND_EVENT, onCommand);
  }, [selected, selectedTag, activeTab]);

  return (
    <div className="devices-page">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      {/* KPI Section */}
      <div className="dv-kpi-strip">
        <div className="dv-kpi-card" onClick={() => setActiveTab('devices')}>
          <div className="dv-kpi-icon dv-kpi-icon--teal"><Icon icon="solar:server-square-bold-duotone" width="20" /></div>
          <div className="dv-kpi-body">
            <div className="dv-kpi-value">{deviceStatus?.deviceCount ?? 0}</div>
            <div className="dv-kpi-label">Devices</div>
          </div>
        </div>
        <div className="dv-kpi-card" onClick={() => setActiveTab('devices')}>
          <div className="dv-kpi-icon dv-kpi-icon--green"><Icon icon="solar:round-transfer-horizontal-bold-duotone" width="20" /></div>
          <div className="dv-kpi-body">
            <div className="dv-kpi-value">{deviceStatus?.converterCount ?? 0}</div>
            <div className="dv-kpi-label">Converters</div>
          </div>
        </div>
        <div className="dv-kpi-card" onClick={() => setActiveTab('devices')}>
          <div className="dv-kpi-icon dv-kpi-icon--amber"><Icon icon="solar:bolt-bold-duotone" width="20" /></div>
          <div className="dv-kpi-body">
            <div className="dv-kpi-value">{deviceStatus?.meterCount ?? 0}</div>
            <div className="dv-kpi-label">Meters</div>
          </div>
        </div>
        <div className="dv-kpi-card" onClick={() => setActiveTab('tags')}>
          <div className="dv-kpi-icon dv-kpi-icon--purple"><Icon icon="solar:tag-bold-duotone" width="20" /></div>
          <div className="dv-kpi-body">
            <div className="dv-kpi-value">{tagStatus?.tagCount ?? 0}</div>
            <div className="dv-kpi-label">Tags</div>
          </div>
        </div>
      </div>

      <div className="devices-layout">
        {/* Status Area */}
        {message && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, backgroundColor: '#10b981', color: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', animation: 'slideIn 0.3s ease-out' }}>
            <Icon icon="solar:check-circle-bold" /> {message}
            <button onClick={() => setMessage('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', marginLeft: '10px' }}>x</button>
          </div>
        )}
        {error && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', animation: 'slideIn 0.3s ease-out' }}>
            <Icon icon="solar:danger-bold" /> {error}
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', marginLeft: '10px' }}>x</button>
          </div>
        )}

        {/* Left Tree Column */}
        {activeTab !== 'templates' && (
          <aside className="devices-tree-panel">
            <section className="dv-card" style={{ flex: 1 }}>
              <div className="dv-card-header">
                <div className="dv-card-title">
                  {viewMode === 'connections' && <Icon icon="solar:server-bold-duotone" width="16" style={{ marginRight: 6, color: '#0ea5e9' }} />}
                  {viewMode === 'groups' && <Icon icon="solar:folder-2-bold-duotone" width="16" style={{ marginRight: 6, color: '#f59e0b' }} />}
                  {viewMode === 'devices' && <Icon icon="solar:list-bold-duotone" width="16" style={{ marginRight: 6, color: '#10b981' }} />}
                  {viewMode === 'connections' ? 'Connections Tree' : viewMode === 'groups' ? 'Groups Tree' : 'Devices Tree'}
                </div>
              </div>
              <div className="dv-card-body dv-tree-container" style={{ overflow: 'auto' }}>
                <div className="dv-tree-root">
                  <Icon
                    icon={viewMode === 'connections' ? "solar:server-bold-duotone" : viewMode === 'groups' ? "solar:folder-2-bold-duotone" : "solar:list-bold-duotone"}
                    width="16"
                    style={{ marginRight: 6, color: viewMode === 'connections' ? '#0ea5e9' : viewMode === 'groups' ? '#f59e0b' : '#10b981' }}
                  />
                  <b>/</b>
                </div>
                {tree.map((node, idx) => (
                  <TreeNodeView
                    key={node.id}
                    node={node}
                    templates={templates}
                    selectedId={selectedId}
                    expandedIds={expandedIds}
                    onSelect={(id: string) => { setSelectedId(id); setActiveTab('details'); }}
                    onToggle={(id: string) => setExpandedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      return next;
                    })}
                    isLast={idx === tree.length - 1}
                  />
                ))}
              </div>
            </section>
          </aside>
        )}

        {/* Right Content Column */}
        <main className="devices-content-panel">
          <div className="dv-tabs">
            <button className={`dv-tab-btn ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>
              <Icon icon="solar:list-bold-duotone" /> Devices
            </button>
            <button className={`dv-tab-btn ${activeTab === 'tags' ? 'active' : ''}`} onClick={() => setActiveTab('tags')}>
              <Icon icon="solar:tag-bold-duotone" /> Tags
            </button>
            <button className={`dv-tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
              <Icon icon="solar:info-circle-bold-duotone" /> Properties
            </button>
            <button className={`dv-tab-btn ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
              <Icon icon="solar:document-add-bold-duotone" /> Templates
            </button>
          </div>

          <section className="dv-card" style={{ flex: 1, overflow: 'hidden' }}>
            <div className="dv-card-body" style={{ padding: 0, overflow: activeTab === 'templates' ? 'hidden' : 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'devices' && (
                <DeviceTable
                  devices={devices}
                  templates={templates}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onEdit={openEditDevice}
                  onDelete={handleDeleteDevice}
                />
              )}
              {activeTab === 'tags' && <TagTable tags={tags} selectedId={selectedTagId} onSelect={setSelectedTagId} onEdit={openEditTag} onDelete={handleDeleteTag} />}
              {activeTab === 'details' && <DeviceDetails device={selected} />}
              {activeTab === 'templates' && <TemplatesWorkspace />}
            </div>
          </section>
        </main>
      </div>

      {/* Dialog Overlays */}
      {dialogMode === 'device' && (
        <div className="dv-dialog-overlay">
          <div className="dv-dialog">
            <div className="dv-dialog-header">
              <div className="dv-dialog-title">
                {deviceIcon(deviceMode, 22)} {isEditing ? 'Edit' : 'Add'} {deviceMode === 'converter' ? 'Converter' : 'Meter'}
              </div>
              <button className="pm-panel-close" onClick={() => setDialogMode('none')}>x</button>
            </div>
            <div className="dv-dialog-body" style={{ position: 'relative' }}>
              {loadingTemplate && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon="solar:restart-bold-duotone" width="40" className="spin" style={{ color: '#0ea5e9' }} />
                  <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#0ea5e9' }}>Loading Template...</div>
                </div>
              )}

              {deviceMode === 'converter' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '10px', textTransform: 'uppercase' }}>Converter Type</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '10px' }}>
                    {[
                      { value: 'tcp', label: 'TCP', desc: 'Generic TCP converter' },
                      { value: 'modbus_tcp', label: 'Modbus TCP', desc: 'Modbus TCP converter' },
                      { value: 'udp', label: 'UDP', desc: 'Generic UDP converter' },
                      { value: 'modbus_rtu', label: 'Modbus RTU', desc: 'RS485/Serial converter' },
                      { value: 'mqtt', label: 'MQTT', desc: 'MQTT broker / IoT gateway' },
                    ].map(item => {
                      const active = deviceForm.protocol === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setDeviceForm({
                            ...deviceForm,
                            protocol: item.value as any,
                            model: item.label,
                            port: item.value === 'mqtt' ? 1883 : (item.value === 'modbus_tcp' || item.value === 'tcp' ? 502 : deviceForm.port),
                          })}
                          style={{ textAlign: 'center', padding: '12px 8px', borderRadius: '12px', border: active ? '2px solid #0f8b94' : '1px solid #dbe6ee', background: active ? '#ecfeff' : '#fff', cursor: 'pointer' }}
                        >
                          <Icon icon={item.value === 'modbus_rtu' ? 'solar:usb-bold-duotone' : item.value === 'mqtt' ? 'solar:wi-fi-router-bold-duotone' : 'solar:server-square-bold-duotone'} width="26" height="26" style={{ color: active ? '#0f8b94' : '#64748b' }} />
                          <strong style={{ display: 'block', color: '#0f172a', marginTop: '6px' }}>{item.label}</strong>
                          <span style={{ display: 'block', color: '#64748b', fontSize: '11px', marginTop: '3px' }}>{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {deviceMode === 'converter' && (
                <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="dv-form-group">
                    <label>Display Name</label>
                    <input value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="e.g. Main_Converter" />
                  </div>
                  <div className="dv-form-group">
                    <label>Selected Type</label>
                    <input value={converterProtocolLabel(deviceForm.protocol)} readOnly style={{ backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }} />
                  </div>
                </div>
              )}

              {deviceMode === 'meter' && deviceWizardStep === 'details' && (
                <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="dv-form-group">
                    <label>Display Name</label>
                    <input value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="e.g. Main_Meter" />
                  </div>
                  <div className="dv-form-group">
                    <label>Location</label>
                    <input value={deviceForm.location ?? ''} onChange={e => setDeviceForm({ ...deviceForm, location: e.target.value })} placeholder="e.g. Floor 1" />
                  </div>
                </div>
              )}

              {deviceMode === 'converter' && (
                <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="dv-form-group">
                    <label>Model Name</label>
                    <input
                      value={deviceForm.model ?? ''}
                      onChange={e => setDeviceForm({ ...deviceForm, model: e.target.value })}
                    />
                  </div>
                  <div className="dv-form-group">
                    <label>Location</label>
                    <input value={deviceForm.location ?? ''} onChange={e => setDeviceForm({ ...deviceForm, location: e.target.value })} placeholder="e.g. Floor 1" />
                  </div>
                </div>
              )}

              {deviceMode === 'meter' && deviceWizardStep === 'driver' ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      {isEditing ? 'Change Meter Driver' : 'Meter Driver Library'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {isEditing ? (
                        <button type="button" className="btn secondary" onClick={() => setDeviceWizardStep('details')}>Back to details</button>
                      ) : null}
                      <button type="button" onClick={handleImportXgmb} style={{ fontSize: '11px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>+ Import .xgmb Driver</button>
                    </div>
                  </div>

                  {visibleBuiltInMeterDrivers.length > 0 && ['CIRCUTOR'].map(vendor => (
                    <div key={vendor} style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '8px', letterSpacing: '0.04em' }}>{vendor}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                        {visibleBuiltInMeterDrivers.map(item => {
                          const active = deviceForm.protocol === item.value && !selectedTemplateId;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => { setSelectedTemplateId(''); setDeviceTags([]); setTagsDirty(false); setDeviceForm({ ...deviceForm, protocol: item.value as any, model: item.label, name: deviceForm.name || normalizeName(item.label) }); }}
                              style={{ textAlign: 'left', padding: '14px', borderRadius: '12px', border: active ? '2px solid #0f8b94' : '1px solid #dbe6ee', background: active ? '#ecfeff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                            >
                              <Icon icon={item.icon} width="28" height="28" style={{ color: active ? '#0f8b94' : '#64748b' }} />
                              <span>
                                <strong style={{ display: 'block', color: '#0f172a' }}>{item.label}</strong>
                                <span style={{ display: 'block', color: '#64748b', fontSize: '12px', marginTop: '3px' }}>{item.desc}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {Object.entries(meterTemplatesByVendor).map(([vendor, vendorTemplates]) => (
                    <div key={vendor} style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '8px', letterSpacing: '0.04em' }}>{vendor}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                        {vendorTemplates.map((template: any) => {
                          const image = templateImage(template);
                          const active = selectedTemplateId === template.id;
                          return (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => void applyTemplateAsMeterDriver(template)}
                              style={{ textAlign: 'left', padding: '14px', borderRadius: '12px', border: active ? '2px solid #0f8b94' : '1px solid #dbe6ee', background: active ? '#ecfeff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                            >
                              {image ? (
                                <img src={image} alt={templateModel(template)} style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '8px', background: '#f8fafc' }} />
                              ) : (
                                <Icon icon="solar:bolt-bold-duotone" width="28" height="28" style={{ color: active ? '#0f8b94' : '#64748b' }} />
                              )}
                              <span>
                                <strong style={{ display: 'block', color: '#0f172a' }}>{templateModel(template)}</strong>
                                <span style={{ display: 'block', color: '#64748b', fontSize: '12px', marginTop: '3px' }}>{vendor} imported XGMB meter driver</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : deviceMode === 'meter' ? (
                <>
                  <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="dv-form-group">
                      <label>Meter Driver</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                        <input
                          type="text"
                          value={meterDriverLabel(deviceForm.protocol, deviceForm.model)}
                          readOnly
                          style={{ backgroundColor: '#f3f4f6', borderColor: '#d1d5db', flex: 1 }}
                        />
                        <button type="button" className="btn secondary" onClick={() => setDeviceWizardStep('driver')}>Change</button>
                      </div>
                      {deviceForm.protocol === 'modbus_tcp' || deviceForm.protocol === 'modbus_rtu' ? (
                        <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '6px' }}>
                          This meter has no driver assigned — click Change to select CVM-C11 or an imported template.
                        </div>
                      ) : null}
                    </div>
                    <div className="dv-form-group">
                      <label>Parent Converter</label>
                      <select value={deviceForm.parentDeviceId ?? ''} onChange={e => {
                        const parentDeviceId = e.target.value || null;
                        setDeviceForm({ ...deviceForm, parentDeviceId });
                      }}>
                        <option value="">-- Select Converter --</option>
                        {converters.map(c => <option key={c.id} value={c.id}>{c.name} ({converterProtocolLabel(c.protocol)})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="dv-form-group">
                      <label>Peripheral Number</label>
                      <input type="number" value={deviceForm.peripheralNumber ?? 1} onChange={e => setDeviceForm({ ...deviceForm, peripheralNumber: toNumber(e.target.value, 1) })} />
                    </div>
                  </div>
                  <div className="dv-modbus-advanced" style={{ border: '1px solid #bae6fd', padding: '12px', borderRadius: '8px', marginBottom: '16px', backgroundColor: '#f0f9ff' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon icon="solar:settings-bold-duotone" /> MODBUS OPTIONS
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                        <input type="checkbox" checked={deviceForm.littleEndianData} onChange={e => setDeviceForm({ ...deviceForm, littleEndianData: e.target.checked })} />
                        Little Endian
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                        <input type="checkbox" checked={deviceForm.swapRegisterBytes} onChange={e => setDeviceForm({ ...deviceForm, swapRegisterBytes: e.target.checked })} />
                        Swap Bytes
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '500' }}>
                        Max Registers:
                        <input type="number" style={{ width: '60px', padding: '2px 6px', border: '1px solid #bae6fd', borderRadius: '4px' }} value={deviceForm.maxRegistersPerGroup ?? 120} onChange={e => setDeviceForm({ ...deviceForm, maxRegistersPerGroup: toNumber(e.target.value, 120) })} />
                      </div>
                    </div>
                  </div>
                </>
              ) : deviceMode === 'converter' ? (
                <>
                  {deviceForm.protocol === 'modbus_rtu' ? (
                    <>
                      <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="dv-form-group">
                          <label>Serial Port</label>
                          <input value={deviceForm.serialPort ?? ''} onChange={e => setDeviceForm({ ...deviceForm, serialPort: e.target.value })} placeholder="COM3" />
                        </div>
                        <div className="dv-form-group">
                          <label>Baud Rate</label>
                          <input type="number" value={deviceForm.baudRate ?? 9600} onChange={e => setDeviceForm({ ...deviceForm, baudRate: toNumber(e.target.value, 9600) })} />
                        </div>
                      </div>
                      <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="dv-form-group">
                          <label>Data Bits</label>
                          <input type="number" value={deviceForm.dataBits ?? 8} onChange={e => setDeviceForm({ ...deviceForm, dataBits: toNumber(e.target.value, 8) })} />
                        </div>
                        <div className="dv-form-group">
                          <label>Parity</label>
                          <select value={deviceForm.parity ?? 'none'} onChange={e => setDeviceForm({ ...deviceForm, parity: e.target.value as any })}>
                            <option value="none">None</option>
                            <option value="even">Even</option>
                            <option value="odd">Odd</option>
                          </select>
                        </div>
                        <div className="dv-form-group">
                          <label>Stop Bits</label>
                          <input type="number" value={deviceForm.stopBits ?? 1} onChange={e => setDeviceForm({ ...deviceForm, stopBits: toNumber(e.target.value, 1) })} />
                        </div>
                      </div>
                    </>
                  ) : deviceForm.protocol === 'mqtt' ? (
                    <>
                      <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="dv-form-group">
                          <label>Broker Host</label>
                          <input value={deviceForm.ipAddress ?? ''} onChange={e => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })} placeholder="192.168.1.10 หรือ test.mosquitto.org" />
                        </div>
                        <div className="dv-form-group">
                          <label>Port</label>
                          <input type="number" value={deviceForm.port ?? 1883} onChange={e => setDeviceForm({ ...deviceForm, port: toNumber(e.target.value, 1883) })} />
                        </div>
                      </div>
                      <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="dv-form-group">
                          <label>Username</label>
                          <input value={(deviceForm as any).mqttUsername ?? ''} onChange={e => setDeviceForm({ ...deviceForm, mqttUsername: e.target.value } as any)} />
                        </div>
                        <div className="dv-form-group">
                          <label>Password</label>
                          <input type="password" value={(deviceForm as any).mqttPassword ?? ''} onChange={e => setDeviceForm({ ...deviceForm, mqttPassword: e.target.value } as any)} />
                        </div>
                        <div className="dv-form-group">
                          <label>Client ID</label>
                          <input value={(deviceForm as any).mqttClientId ?? ''} onChange={e => setDeviceForm({ ...deviceForm, mqttClientId: e.target.value } as any)} placeholder="energylink_editor" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div className="dv-form-group">
                        <label>Converter Address (IP)</label>
                        <input value={deviceForm.ipAddress ?? ''} onChange={e => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })} placeholder="192.168.1.59" />
                      </div>
                      <div className="dv-form-group">
                        <label>Port</label>
                        <input type="number" value={deviceForm.port ?? 502} onChange={e => setDeviceForm({ ...deviceForm, port: toNumber(e.target.value, 502) })} />
                      </div>
                    </div>
                  )}
                  <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="dv-form-group">
                      <label>Polling (ms)</label>
                      <input type="number" value={deviceForm.pollingIntervalMs ?? 1000} onChange={e => setDeviceForm({ ...deviceForm, pollingIntervalMs: toNumber(e.target.value, 1000) })} />
                    </div>
                    <div className="dv-form-group">
                      <label>Timeout (ms)</label>
                      <input type="number" value={deviceForm.timeoutMs ?? 2000} onChange={e => setDeviceForm({ ...deviceForm, timeoutMs: toNumber(e.target.value, 2000) })} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="dv-form-group">
                      <label>Parent Converter</label>
                      <select value={deviceForm.parentDeviceId ?? ''} onChange={e => {
                        const parentDeviceId = e.target.value || null;
                        setDeviceForm({ ...deviceForm, parentDeviceId, protocol: protocolFromParent(parentDeviceId) });
                      }}>
                        <option value="">-- Select Converter --</option>
                        {converters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="dv-form-group">
                      <label>Driver Protocol</label>
                      <input type="text" value={activeParentProtocol} readOnly style={{ backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }} />
                    </div>
                  </div>
                  <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="dv-form-group">
                      <label>Peripheral Number</label>
                      <input type="number" value={deviceForm.peripheralNumber ?? 1} onChange={e => setDeviceForm({ ...deviceForm, peripheralNumber: toNumber(e.target.value, 1) })} />
                    </div>
                  </div>
                </>
              )}

              {!(deviceMode === 'meter' && deviceWizardStep === 'driver') && deviceWizardStep === 'details' && (
                <DeviceEnergyMappingCard
                  mapping={energyMapping}
                  onChange={setEnergyMapping}
                  deviceType={deviceMode}
                  showAdvanced={energyAdvancedOpen}
                  onToggleAdvanced={() => setEnergyAdvancedOpen(v => !v)}
                />
              )}

              {deviceMode === 'meter' && deviceWizardStep === 'details' && deviceTags.length > 0 && (
                <div className="dv-energy-card" style={{ marginTop: 16 }}>
                  <div className="dv-energy-card-title">Carbon</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={carbonAsMainMeter}
                      onChange={e => setCarbonAsMainMeter(e.target.checked)}
                    />
                    Site main meter
                  </label>
                  <div className="dv-form-group">
                    <label>Primary kWh tag</label>
                    <select
                      value={carbonPrimaryTagName}
                      onChange={e => setCarbonPrimaryTagName(e.target.value)}
                    >
                      <option value="">Auto</option>
                      {deviceTags.map((t: any) => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {!(deviceMode === 'meter' && deviceWizardStep === 'driver') && deviceWizardStep === 'details' && (
                <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                  <label>Device Assets (2D + 3D)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>2D Icon</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {deviceForm.imageDataUrl ? (
                          <img src={deviceForm.imageDataUrl} alt="Device preview" style={{ width: '64px', height: '64px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }} />
                        ) : (
                          <div style={{ width: '64px', height: '64px', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '10px', textAlign: 'center', padding: '4px' }}>No image</div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button type="button" className="btn secondary" onClick={handleDeviceImage}>Upload image</button>
                          {deviceForm.imageDataUrl ? (
                            <button type="button" className="btn secondary" onClick={() => setDeviceForm({ ...deviceForm, imageDataUrl: '' })}>Remove</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>3D Model (GLB)</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {deviceForm.model3dUrl ? (
                          <div style={{ width: '64px', height: '64px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#6366f1' }}>GLB</div>
                        ) : (
                          <div style={{ width: '64px', height: '64px', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '10px', textAlign: 'center', padding: '4px' }}>No 3D</div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button type="button" className="btn secondary" onClick={handleDeviceModel3d}>Import GLB</button>
                          {deviceForm.model3dUrl ? (
                            <button type="button" className="btn secondary" onClick={() => setDeviceForm({ ...deviceForm, model3dUrl: '' })}>Remove</button>
                          ) : null}
                        </div>
                      </div>
                      {deviceForm.model3dUrl ? (
                        <p style={{ fontSize: '10px', color: '#64748b', margin: '6px 0 0' }}>
                          {deviceForm.model3dUrl.startsWith('asset://') ? 'Stored in Asset Library' : 'Embedded model'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {!(deviceMode === 'meter' && deviceWizardStep === 'driver') && (
                <div
                  className="dv-form-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: deviceMode === 'converter' ? '1fr' : '1fr 1fr',
                    gap: '16px',
                    marginBottom: '16px'
                  }}
                >
                  {deviceMode !== 'converter' && (
                    <div className="dv-form-group">
                      <label>Timeout (ms)</label>
                      <input type="number" value={deviceForm.timeoutMs ?? 2000} onChange={e => setDeviceForm({ ...deviceForm, timeoutMs: toNumber(e.target.value, 2000) })} />
                    </div>
                  )}
                  <div className="dv-form-group">
                    <label>Options</label>
                    <div style={{ display: 'flex', gap: '15px', height: '38px', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={deviceForm.communicationEnabled} onChange={e => setDeviceForm({ ...deviceForm, communicationEnabled: e.target.checked })} />
                        Comm
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={deviceForm.historyEnabled} onChange={e => setDeviceForm({ ...deviceForm, historyEnabled: e.target.checked })} />
                        History
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={deviceForm.visible} onChange={e => setDeviceForm({ ...deviceForm, visible: e.target.checked })} />
                        Visible
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {deviceMode === 'meter' && deviceWizardStep === 'details' && deviceTags.length > 0 && (
                <div className="dv-variables-summary" style={{ marginTop: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>CONFIGURED VARIABLES ({deviceTags.length})</div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ fontSize: '10px', color: '#10b981' }}>{deviceTags.filter(t => t.type !== 'BINARY').length} Numeric</span>
                      <span style={{ fontSize: '10px', color: '#f59e0b' }}>{deviceTags.filter(t => t.type === 'BINARY').length} Binary</span>
                    </div>
                  </div>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                    <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', boxShadow: '0 1px 0 #e2e8f0' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '4px' }}>Name</th>
                          <th style={{ textAlign: 'left', padding: '4px' }}>Addr</th>
                          <th style={{ textAlign: 'left', padding: '4px' }}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceTags.map((t, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px', color: '#1e293b' }}>{t.name}</td>
                            <td style={{ padding: '4px', color: '#64748b' }}>{t.address}</td>
                            <td style={{ padding: '4px', color: '#64748b' }}>{t.dataType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="dv-dialog-footer">
              <button className="btn secondary" onClick={() => setDialogMode('none')}>Cancel</button>
              <div className="spacer" />
              {deviceMode === 'meter' && deviceWizardStep === 'driver' ? (
                <>
                  {isEditing ? (
                    <button type="button" className="btn secondary" onClick={() => setDeviceWizardStep('details')}>Back to details</button>
                  ) : null}
                  <button className="btn primary" disabled={!deviceForm.model} onClick={() => setDeviceWizardStep('details')}>
                    {isEditing ? 'Apply driver' : 'Next'}
                  </button>
                </>
              ) : (
                <button className="btn primary" onClick={handleSaveDevice}>Accept</button>
              )}
            </div>
          </div>
        </div>
      )}

      {dialogMode === 'tag' && (
        <div className="dv-dialog-overlay">
          <div className="dv-dialog">
            <div className="dv-dialog-header">
              <div className="dv-dialog-title"><Icon icon="solar:tag-bold-duotone" width="22" /> {isEditing ? 'Edit' : 'Add'} Tag</div>
              <button className="pm-panel-close" onClick={() => setDialogMode('none')}>x</button>
            </div>
            <div className="dv-dialog-body">
              <div className="dv-form-group">
                <label>Device</label>
                <select value={tagForm.deviceId} onChange={e => setTagForm({ ...tagForm, deviceId: e.target.value })}>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="dv-form-group">
                  <label>Tag Name</label>
                  <input value={tagForm.name} onChange={e => setTagForm({ ...tagForm, name: e.target.value })} />
                </div>
                {devices.find(d => d.id === tagForm.deviceId)?.protocol === 'mqtt' ? (
                  <div className="dv-form-group">
                    <label>MQTT Topic</label>
                    <input value={(tagForm as any).mqttTopic ?? ''} onChange={e => setTagForm({ ...tagForm, mqttTopic: e.target.value } as any)} placeholder="sensors/temp/room1" />
                  </div>
                ) : (
                  <div className="dv-form-group">
                    <label>Address</label>
                    <input type="number" value={tagForm.address} onChange={e => setTagForm({ ...tagForm, address: toNumber(e.target.value, 0) })} />
                  </div>
                )}
              </div>
              {devices.find(d => d.id === tagForm.deviceId)?.protocol === 'mqtt' ? (
                <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="dv-form-group">
                    <label>Data Type</label>
                    <select value={tagForm.dataType} onChange={e => setTagForm({ ...tagForm, dataType: e.target.value as TagDataType })}>
                      <option value="float32">Float32</option>
                      <option value="int32">Int32</option>
                      <option value="bool">Bool</option>
                    </select>
                  </div>
                  <div className="dv-form-group">
                    <label>Unit</label>
                    <input value={tagForm.unit ?? ''} onChange={e => setTagForm({ ...tagForm, unit: e.target.value })} placeholder="°C, kW…" />
                  </div>
                </div>
              ) : (
              <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="dv-form-group">
                  <label>Register Type</label>
                  <select value={tagForm.registerType} onChange={e => setTagForm({ ...tagForm, registerType: e.target.value as TagRegisterType })}>
                    <option value="holding_register">Holding Register</option>
                    <option value="input_register">Input Register</option>
                  </select>
                </div>
                <div className="dv-form-group">
                  <label>Data Type</label>
                  <select value={tagForm.dataType} onChange={e => setTagForm({ ...tagForm, dataType: e.target.value as TagDataType })}>
                    <option value="float32">Float32</option>
                    <option value="int32">Int32</option>
                    <option value="bool">Bool</option>
                  </select>
                </div>
              </div>
              )}
              <div className="dv-form-group" style={{ marginTop: 16 }}>
                <label>Energy role</label>
                <select
                  value={tagForm.energyTagRole ?? 'none'}
                  onChange={e => setTagForm({ ...tagForm, energyTagRole: e.target.value })}
                >
                  {TAG_ENERGY_ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="dv-dialog-footer">
              <button className="btn secondary" onClick={() => setDialogMode('none')}>Cancel</button>
              <div className="spacer" />
              <button className="btn primary" onClick={handleSaveTag}>Accept</button>
            </div>
          </div>
        </div>
      )}

      {dialogMode === 'import_template' && (
        <div className="dv-dialog-overlay">
          <div className="dv-dialog" style={{ maxWidth: '600px' }}>
            <div className="dv-dialog-header">
              <div className="dv-dialog-title"><Icon icon="solar:download-bold-duotone" width="22" /> Import Device Template</div>
              <button className="pm-panel-close" onClick={() => setDialogMode('none')}>x</button>
            </div>
            <div className="dv-dialog-body">
              <div className="dv-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="dv-form-group">
                  <label>Category (Topic)</label>
                  <select
                    value={isNewImportCategory ? '___NEW___' : importForm.category}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '___NEW___') {
                        setIsNewImportCategory(true);
                        setImportForm({ ...importForm, category: '' });
                      } else {
                        setIsNewImportCategory(false);
                        setImportForm({ ...importForm, category: val });
                      }
                    }}
                  >
                    {existingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    <option value="___NEW___">+ Add New Category...</option>
                  </select>
                  {isNewImportCategory && (
                    <input
                      style={{ marginTop: '8px' }}
                      value={importForm.category}
                      onChange={e => setImportForm({ ...importForm, category: e.target.value })}
                      placeholder="Type new category..."
                    />
                  )}
                </div>
                <div className="dv-form-group">
                  <label>Vendor (Brand)</label>
                  <select
                    value={isNewImportVendor ? '___NEW___' : importForm.vendor}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '___NEW___') {
                        setIsNewImportVendor(true);
                        setImportForm({ ...importForm, vendor: '' });
                      } else {
                        setIsNewImportVendor(false);
                        setImportForm({ ...importForm, vendor: val });
                      }
                    }}
                  >
                    {existingVendors.map(v => <option key={v} value={v}>{v}</option>)}
                    <option value="___NEW___">+ Add New Vendor...</option>
                  </select>
                  {isNewImportVendor && (
                    <input
                      style={{ marginTop: '8px' }}
                      value={importForm.vendor}
                      onChange={e => setImportForm({ ...importForm, vendor: e.target.value })}
                      placeholder="e.g. Socomec, CIRCUTOR, Janitza"
                    />
                  )}
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>Brand only, not model name. Example: Socomec / CIRCUTOR / Janitza.</div>
                </div>
              </div>
              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Template Name (Model)</label>
                <input value={importForm.templateName} onChange={e => setImportForm({ ...importForm, templateName: e.target.value })} placeholder="e.g. PM5100" />
              </div>
              <div className="dv-form-group" style={{ marginBottom: '16px' }}>
                <label>Device Image</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {importForm.imageDataUrl ? (
                    <img src={importForm.imageDataUrl} alt="Device preview" style={{ width: '64px', height: '64px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }} />
                  ) : (
                    <div style={{ width: '64px', height: '64px', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                      <Icon icon="solar:gallery-add-bold-duotone" width="28" style={{ color: '#94a3b8' }} />
                    </div>
                  )}
                  <button type="button" className="btn secondary" onClick={handleImportDeviceImage}>Choose Image</button>
                  {importForm.imageDataUrl && <button type="button" className="btn secondary" onClick={() => setImportForm({ ...importForm, imageDataUrl: '' })}>Remove</button>}
                </div>
              </div>

              {importPreview && (
                <div className="dv-import-preview" style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#64748b' }}>FILE CONTENT PREVIEW</div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc', fontSize: '11px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <b>Modbus Config:</b> {importPreview.littleEndianData ? 'Little Endian' : 'Big Endian'},
                      Max Regs: {importPreview.maxRegisters}
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9' }}>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '4px' }}>Name</th>
                            <th style={{ textAlign: 'left', padding: '4px' }}>Addr</th>
                            <th style={{ textAlign: 'left', padding: '4px' }}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.variables.map((v: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '4px' }}>{v.name}</td>
                              <td style={{ padding: '4px' }}>{v.initAddress}</td>
                              <td style={{ padding: '4px' }}>{v.dataType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="dv-dialog-footer">
              <button className="btn secondary" onClick={() => setDialogMode('none')}>Cancel</button>
              <div className="spacer" />
              <button className="btn primary" onClick={confirmImportTemplate}>Save to Library</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function TreeNodeView({ node, templates, selectedId, expandedIds, onSelect, onToggle, isLast }: any) {
  const expanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const selected = selectedId === node.id;
  return (
    <div className={`tree-node ${isLast ? 'is-last' : ''}`}>
      <div className={`device-tree-row ${selected ? 'selected' : ''}`} onClick={() => onSelect(node.id)}>
        <span onClick={(e) => { e.stopPropagation(); onToggle(node.id); }} style={{ cursor: 'pointer', width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasChildren && <Icon icon={expanded ? "solar:alt-arrow-down-bold" : "solar:alt-arrow-right-bold"} width="12" />}
        </span>
        <DeviceNodeIcon device={node} templates={templates} size={18} color={selected ? undefined : undefined} />
        <span style={{ marginLeft: 6 }}>{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div style={{ marginLeft: 16 }}>
          {node.children.map((child: any, idx: number) => (
            <TreeNodeView
              key={child.id}
              node={child}
              templates={templates}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceTable({ devices, templates, selectedId, onSelect, onEdit, onDelete }: any) {
  return (
    <table className="pm-table">
      <thead>
        <tr><th>Name</th><th>Type</th><th>Protocol</th><th>Address/No.</th><th>Actions</th></tr>
      </thead>
      <tbody>
        {devices.map((d: any) => (
          <tr key={d.id} className={selectedId === d.id ? 'pm-row--selected' : ''} onClick={() => onSelect(d.id)}>
            <td>
              <div className="pm-project-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DeviceNodeIcon device={d} templates={templates} size={28} />
                <b>{d.name}</b>
              </div>
            </td>
            <td><span className="device-pill unknown">{d.type}</span></td>
            <td>{d.protocol}</td>
            <td>{d.type === 'converter' ? d.ipAddress : `No. ${d.peripheralNumber}`}</td>
            <td>
              <div className="pm-row-actions">
                <button className="pm-action-btn pm-action-btn--edit" onClick={() => onEdit(d)}>Edit</button>
                <button className="pm-action-btn pm-action-btn--delete" onClick={() => onDelete(d.id, d.name)}>Delete</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TagTable({ tags, selectedId, onSelect, onEdit, onDelete }: any) {
  return (
    <table className="pm-table">
      <thead>
        <tr><th>Tag Name</th><th>Address</th><th>Type</th><th>Actions</th></tr>
      </thead>
      <tbody>
        {tags.map((t: any) => (
          <tr key={t.id} className={selectedId === t.id ? 'pm-row--selected' : ''} onClick={() => onSelect(t.id)}>
            <td><b>{t.name}</b></td>
            <td>{t.address}</td>
            <td>{t.dataType}</td>
            <td>
              <div className="pm-row-actions">
                <button className="pm-action-btn pm-action-btn--edit" onClick={() => onEdit(t)}>Edit</button>
                <button className="pm-action-btn pm-action-btn--delete" onClick={() => onDelete(t.id, t.name)}>Delete</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeviceDetails({ device }: { device: DeviceSummary | null | undefined }) {
  if (!device) return <div className="pm-empty"><Icon icon="solar:info-circle-bold-duotone" className="pm-empty-icon" /> <p>Select a device to view properties</p></div>;
  const energy = resolveDeviceEnergyMapping(device);
  const notes = stripLegacyBlockFromDescription(device.description);
  return (
    <div className="dv-dialog-body">
      <div className="dv-prop-grid">
        <div className="dv-prop-item"><span className="dv-prop-label">Name</span><span className="dv-prop-value">{device.name}</span></div>
        <div className="dv-prop-item"><span className="dv-prop-label">Type</span><span className="dv-prop-value">{device.type}</span></div>
        <div className="dv-prop-item"><span className="dv-prop-label">Protocol</span><span className="dv-prop-value">{device.protocol}</span></div>
        <div className="dv-prop-item"><span className="dv-prop-label">Address</span><span className="dv-prop-value">{device.ipAddress || device.serialPort || '-'}</span></div>
        <div className="dv-prop-item"><span className="dv-prop-label">Peripheral No.</span><span className="dv-prop-value">{device.peripheralNumber}</span></div>
        <div className="dv-prop-item"><span className="dv-prop-label">Location</span><span className="dv-prop-value">{device.location || '-'}</span></div>
        <DeviceEnergyMappingSummary mapping={energy} />
        {notes ? (
          <div className="dv-prop-item dv-prop-span-2">
            <span className="dv-prop-label">Notes</span>
            <span className="dv-prop-value">{notes}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

