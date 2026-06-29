import { useEffect, useMemo, useState } from 'react';
import { FileWorkspace } from './features/file/FileWorkspace';
import { DevicesWorkspace } from './features/devices/DevicesWorkspace';
import { GraphicsEditor } from './features/graphics/editor/GraphicsEditor';
import { ReportsWorkspace } from './features/reports/ReportsWorkspace';
import { buildReportLeftToolPanels } from './features/reports/reportTools';
import { SetupWorkspace } from './features/setup/SetupWorkspace';
import { TemplatesWorkspace } from './features/templates/TemplatesWorkspace';
import { EditorStatusBar } from './components/EditorStatusBar';
import { dispatchEditorCommand } from './commandBus';
import { Icon } from '@iconify/react';

type AppModule = 'file' | 'devices' | 'graphics' | 'reports' | 'templates' | 'setup';

type RibbonItem = {
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  wide?: boolean;
};

type RibbonGroup = {
  label: string;
  items: RibbonItem[];
};

const labels: Record<AppModule, string> = {
  file: 'File',
  devices: 'Devices',
  graphics: 'Graphics',
  reports: 'Reports',
  templates: 'Templates',
  setup: 'Setup'
};

const modules: AppModule[] = ['file', 'devices', 'graphics', 'reports', 'templates', 'setup'];

const GROUP = {
  project: 'Project',
  management: 'Management',
  engine: 'Engine',
  views: 'Views',
  add: 'Add',
  device: 'Device',
  tag: 'Tag',
  tree: 'Tree',
  file: 'File',
  actions: 'Actions',
  placement: 'Placement / View',
  data: 'Data',
  output: 'Output',
  setup: 'Setup',
  logic: 'Logic',
  engineData: 'Engine / Data',
  pagePlacement: 'Page / Placement',
  package: 'Package',
  application: 'Application'
};

const ICON = {
  new: <Icon icon="solar:document-add-bold-duotone" width="24" height="24" style={{ color: '#3b82f6' }} />,
  open: <Icon icon="solar:folder-open-bold-duotone" width="24" height="24" style={{ color: '#f59e0b' }} />,
  save: <Icon icon="solar:diskette-bold-duotone" width="24" height="24" style={{ color: '#10b981' }} />,
  engine: <Icon icon="solar:cpu-bold-duotone" width="24" height="24" style={{ color: '#06b6d4' }} />,
  import: <Icon icon="solar:download-bold-duotone" width="24" height="24" style={{ color: '#8b5cf6' }} />,
  export: <Icon icon="solar:upload-bold-duotone" width="24" height="24" style={{ color: '#ec4899' }} />,
  exit: <Icon icon="solar:logout-bold-duotone" width="24" height="24" style={{ color: '#ef4444' }} />,
  network: <Icon icon="solar:global-bold-duotone" width="24" height="24" style={{ color: '#14b8a6' }} />,
  groups: <Icon icon="solar:users-group-two-rounded-bold-duotone" width="24" height="24" style={{ color: '#6366f1' }} />,
  devices: <Icon icon="solar:server-bold-duotone" width="24" height="24" style={{ color: '#4b5563' }} />,
  converter: <Icon icon="solar:round-transfer-horizontal-bold-duotone" width="24" height="24" style={{ color: '#10b981' }} />,
  meter: <Icon icon="solar:bolt-bold-duotone" width="24" height="24" style={{ color: '#f59e0b' }} />,
  sensor: <Icon icon="solar:thermometer-bold-duotone" width="24" height="24" style={{ color: '#ef4444' }} />,
  edit: <Icon icon="solar:pen-new-square-bold-duotone" width="24" height="24" style={{ color: '#3b82f6' }} />,
  delete: <Icon icon="solar:trash-bin-trash-bold-duotone" width="24" height="24" style={{ color: '#ef4444' }} />,
  tag: <Icon icon="solar:tag-bold-duotone" width="24" height="24" style={{ color: '#0ea5e9' }} />,
  list: <Icon icon="solar:bill-list-bold-duotone" width="24" height="24" style={{ color: '#6b7280' }} />,
  expand: <Icon icon="solar:add-square-bold-duotone" width="24" height="24" style={{ color: '#10b981' }} />,
  collapse: <Icon icon="solar:minus-square-bold-duotone" width="24" height="24" style={{ color: '#ef4444' }} />,
  refresh: <Icon icon="solar:refresh-bold-duotone" width="24" height="24" style={{ color: '#3b82f6' }} />,
  designer: <Icon icon="solar:palette-bold-duotone" width="24" height="24" style={{ color: '#f43f5e' }} />,
  validate: <Icon icon="solar:shield-check-bold-duotone" width="24" height="24" style={{ color: '#10b981' }} />,
  preview: <Icon icon="solar:play-bold-duotone" width="24" height="24" style={{ color: '#10b981' }} />,
  view: <Icon icon="solar:eye-bold-duotone" width="24" height="24" style={{ color: '#06b6d4' }} />,
  publish: <Icon icon="solar:rocket-bold-duotone" width="24" height="24" style={{ color: '#8b5cf6' }} />,
  align: <Icon icon="solar:align-left-bold-duotone" width="24" height="24" style={{ color: '#6b7280' }} />,
  grid: <Icon icon="solar:widget-2-bold-duotone" width="24" height="24" style={{ color: '#6b7280' }} />,
  lock: <Icon icon="solar:lock-keyhole-bold-duotone" width="24" height="24" style={{ color: '#f59e0b' }} />,
  zoom: <Icon icon="solar:minimalistic-magnifer-bold-duotone" width="24" height="24" style={{ color: '#0ea5e9' }} />,
  tools: <Icon icon="solar:settings-bold-duotone" width="24" height="24" style={{ color: '#4b5563' }} />,
  page: <Icon icon="solar:document-bold-duotone" width="24" height="24" style={{ color: '#3b82f6' }} />,
  pdf: <Icon icon="solar:document-text-bold-duotone" width="24" height="24" style={{ color: '#ef4444' }} />,
  excel: <Icon icon="solar:bill-list-bold-duotone" width="24" height="24" style={{ color: '#10b981' }} />,
  print: <Icon icon="solar:printer-bold-duotone" width="24" height="24" style={{ color: '#4b5563' }} />,
  settings: <Icon icon="solar:settings-minimalistic-bold-duotone" width="24" height="24" style={{ color: '#3b82f6' }} />,
  units: <Icon icon="solar:bolt-circle-bold-duotone" width="24" height="24" style={{ color: '#f59e0b' }} />,
  palette: <Icon icon="solar:palette-bold-duotone" width="24" height="24" style={{ color: '#ec4899' }} />,
  image: <Icon icon="solar:gallery-bold-duotone" width="24" height="24" style={{ color: '#10b981' }} />,
  formula: <Icon icon="solar:calculator-bold-duotone" width="24" height="24" style={{ color: '#8b5cf6' }} />,
  alarm: <Icon icon="solar:bell-bing-bold-duotone" width="24" height="24" style={{ color: '#f59e0b' }} />,
  web: <Icon icon="solar:global-bold-duotone" width="24" height="24" style={{ color: '#06b6d4' }} />,
  database: <Icon icon="solar:database-bold-duotone" width="24" height="24" style={{ color: '#8b5cf6' }} />,
  backup: <Icon icon="solar:archive-bold-duotone" width="24" height="24" style={{ color: '#4b5563' }} />,
  templates: <Icon icon="solar:document-add-bold-duotone" width="24" height="24" style={{ color: '#8b5cf6' }} />
};

const ribbonGroups: Record<AppModule, RibbonGroup[]> = {
  file: [
    { label: GROUP.project, items: [
      { label: 'New', icon: ICON.new, primary: true },
      { label: 'Open', icon: ICON.open },
      { label: 'Save', icon: ICON.save }
    ] },
    { label: GROUP.package, items: [
      { label: 'Import', icon: ICON.import },
      { label: 'Export', icon: ICON.export }
    ] },
    { label: GROUP.application, items: [
      { label: 'Exit', icon: ICON.exit }
    ] }
  ],
  devices: [
    { label: GROUP.views, items: [
      { label: 'Connections', icon: ICON.network, primary: true },
      { label: 'Groups', icon: ICON.groups },
      { label: 'Devices', icon: ICON.devices },
      { label: 'Templates', icon: ICON.templates }
    ] },
    { label: GROUP.add, items: [
      { label: 'Add Converter', icon: ICON.converter, wide: true },
      { label: 'Add Meter', icon: ICON.meter }
    ] },
    { label: GROUP.device, items: [
      { label: 'Modify', icon: ICON.edit },
      { label: 'Delete', icon: ICON.delete }
    ] },
    { label: GROUP.tag, items: [
      { label: 'Add Tag', icon: ICON.tag },
      { label: 'Tag List', icon: ICON.list }
    ] },
    { label: GROUP.tree, items: [
      { label: 'Expand', icon: ICON.expand },
      { label: 'Collapse', icon: ICON.collapse },
      { label: 'Refresh', icon: ICON.refresh }
    ] }
  ],
  templates: [
    { label: GROUP.file, items: [
      { label: 'Import XGMB', icon: ICON.import, primary: true },
      { label: 'Export', icon: ICON.export }
    ] },
    { label: GROUP.management, items: [
      { label: 'New Template', icon: ICON.new },
      { label: 'Delete', icon: ICON.delete }
    ] }
  ],
  graphics: [
    { label: GROUP.file, items: [
      { label: 'Designer', icon: ICON.designer, primary: true },
      { label: 'Graphics List', icon: ICON.list, wide: true },
      { label: 'New Graphic', icon: ICON.new, wide: true },
      { label: 'Save', icon: ICON.save },
      { label: 'Delete', icon: ICON.delete }
    ] },
    { label: GROUP.actions, items: [
      { label: 'Validate', icon: ICON.validate },
      { label: 'Preview', icon: ICON.preview, wide: true }
    ] },
    { label: GROUP.placement, items: [
      { label: 'Grid 20px', icon: ICON.grid },
      { label: 'Measure', icon: ICON.zoom },
      { label: 'Lock', icon: ICON.lock },
      { label: 'Zoom', icon: ICON.zoom }
    ] },
    { label: GROUP.data, items: [
      { label: 'Bind Tag', icon: ICON.tag, wide: true },
      { label: 'Object Tools', icon: ICON.tools, wide: true }
    ] }
  ],
  reports: [
    { label: GROUP.file, items: [
      { label: 'Designer', icon: ICON.designer, primary: true },
      { label: 'Reports List', icon: ICON.list, wide: true },
      { label: 'New Report', icon: ICON.new, wide: true },
      { label: 'Save', icon: ICON.save },
      { label: 'Delete', icon: ICON.delete }
    ] },
    { label: GROUP.actions, items: [
      { label: 'Validate', icon: ICON.validate },
      { label: 'Preview', icon: ICON.view }
    ] },
    { label: GROUP.pagePlacement, items: [
      { label: 'Page Setup', icon: ICON.page, wide: true },
      { label: 'Align', icon: ICON.align },
      { label: 'Grid 20px', icon: ICON.grid },
      { label: 'Lock', icon: ICON.lock }
    ] },
    { label: GROUP.output, items: [
      { label: 'Export PDF', icon: ICON.pdf, wide: true },
      { label: 'Export Excel', icon: ICON.excel, wide: true },
      { label: 'Print', icon: ICON.print }
    ] }
  ],
  setup: [
    { label: GROUP.setup, items: [
      { label: 'Preferences', icon: ICON.settings, primary: true },
      { label: 'Units', icon: ICON.units },
      { label: 'Styles', icon: ICON.palette },
      { label: 'Images', icon: ICON.image }
    ] },
    { label: GROUP.logic, items: [
      { label: 'Calculated Variables', icon: ICON.formula, wide: true },
      { label: 'Events', icon: ICON.alarm }
    ] },
    { label: GROUP.engineData, items: [
      { label: 'Engine', icon: ICON.engine },
      { label: 'Web Viewer', icon: ICON.web, wide: true },
      { label: 'Database', icon: ICON.database },
      { label: 'Backup', icon: ICON.backup }
    ] }
  ]
};

const leftToolPanels: Record<AppModule, Array<{ title?: string; items: RibbonItem[] }>> = {
  file: [
    { items: [] }
  ],
  templates: [
    { items: [] }
  ],
  devices: [
    { title: 'Connections', items: [
      { label: 'Connections', icon: <Icon icon="solar:global-bold-duotone" width="20" height="20" style={{ color: '#10b981' }} />, primary: true, wide: true },
      { label: 'Groups', icon: <Icon icon="solar:users-group-two-rounded-bold-duotone" width="20" height="20" style={{ color: '#6366f1' }} />, wide: true },
      { label: 'Templates', icon: <Icon icon="solar:document-add-bold-duotone" width="20" height="20" style={{ color: '#8b5cf6' }} />, wide: true }
    ] },
    { title: 'Devices', items: [
      { label: 'Add Converter', icon: <Icon icon="solar:round-transfer-horizontal-bold-duotone" width="20" height="20" style={{ color: '#10b981' }} />, wide: true },
      { label: 'Add Meter', icon: <Icon icon="solar:bolt-bold-duotone" width="20" height="20" style={{ color: '#f59e0b' }} />, wide: true }
    ] },
    { title: 'Actions', items: [
      { label: 'Modify', icon: <Icon icon="solar:pen-new-square-bold-duotone" width="20" height="20" style={{ color: '#3b82f6' }} />, wide: true },
      { label: 'Delete', icon: <Icon icon="solar:trash-bin-trash-bold-duotone" width="20" height="20" style={{ color: '#ef4444' }} />, wide: true },
      { label: 'Import Config', icon: <Icon icon="solar:download-bold-duotone" width="20" height="20" style={{ color: '#8b5cf6' }} />, wide: true }
    ] }
  ],
  graphics: [
    { title: 'Power', items: [
      { label: 'Line', icon: <Icon icon="solar:pen-bold-duotone" width="20" height="20" style={{ color: '#6b7280' }} /> },
      { label: 'Button', icon: <Icon icon="solar:cursor-bold-duotone" width="20" height="20" style={{ color: '#ec4899' }} /> },
      { label: 'Value', icon: <Icon icon="solar:hashtag-bold-duotone" width="20" height="20" style={{ color: '#0ea5e9' }} /> },
      { label: 'Gauge', icon: <Icon icon="solar:gauge-bold-duotone" width="20" height="20" style={{ color: '#f59e0b' }} /> }
    ] },
    { title: 'Widgets', items: [
      { label: 'Trend', icon: <Icon icon="solar:chart-square-bold-duotone" width="20" height="20" style={{ color: '#8b5cf6' }} /> },
      { label: 'Sparkline', icon: <Icon icon="solar:graph-up-bold-duotone" width="20" height="20" style={{ color: '#a855f7' }} /> },
      { label: 'Bar Chart', icon: <Icon icon="solar:chart-2-bold-duotone" width="20" height="20" style={{ color: '#f59e0b' }} /> },
      { label: 'Tag Table', icon: <Icon icon="solar:bill-list-bold-duotone" width="20" height="20" style={{ color: '#10b981' }} /> },
      { label: 'Alarm Table', icon: <Icon icon="solar:danger-triangle-bold-duotone" width="20" height="20" style={{ color: '#ef4444' }} /> },
      { label: 'Panel', icon: <Icon icon="solar:widget-4-bold-duotone" width="20" height="20" style={{ color: '#64748b' }} /> }
    ] },
    { title: 'SLD', items: [
      { label: 'Flow Path', icon: <Icon icon="solar:routing-2-bold-duotone" width="20" height="20" style={{ color: '#22d3ee' }} /> },
      { label: 'Elec Symbol', icon: <Icon icon="solar:plug-circle-bold-duotone" width="20" height="20" style={{ color: '#f59e0b' }} /> },
      { label: 'Hotspot', icon: <Icon icon="solar:target-bold-duotone" width="20" height="20" style={{ color: '#06b6d4' }} /> }
    ] },
    { title: 'Drawing', items: [
      { label: 'Object Tools', icon: <Icon icon="solar:tuning-square-bold-duotone" width="20" height="20" style={{ color: '#4b5563' }} />, primary: true },
      { label: 'Text', icon: <Icon icon="solar:text-bold-duotone" width="20" height="20" style={{ color: '#3b82f6' }} /> },
      { label: 'Image', icon: <Icon icon="solar:gallery-bold-duotone" width="20" height="20" style={{ color: '#10b981' }} /> },
      { label: 'Rectangle', icon: <Icon icon="solar:box-bold-duotone" width="20" height="20" style={{ color: '#3b82f6' }} /> },
      { label: 'Circle', icon: <Icon icon="solar:circle-bold-duotone" width="20" height="20" style={{ color: '#0ea5e9' }} /> },
      { label: 'Tab Bar', icon: <Icon icon="solar:folder-with-files-bold-duotone" width="20" height="20" style={{ color: '#6366f1' }} /> }
    ] },
    { title: 'Controls', items: [
      { label: 'Switch', icon: <Icon icon="solar:toggle-bold-duotone" width="20" height="20" style={{ color: '#22c55e' }} /> },
      { label: 'Slider', icon: <Icon icon="solar:sliders-bold-duotone" width="20" height="20" style={{ color: '#a855f7' }} /> },
      { label: 'LED', icon: <Icon icon="solar:lightbulb-bold-duotone" width="20" height="20" style={{ color: '#facc15' }} /> },
      { label: 'Level Bar', icon: <Icon icon="solar:waterdrop-bold-duotone" width="20" height="20" style={{ color: '#0891b2' }} /> },
      { label: 'Multi-State', icon: <Icon icon="solar:layers-bold-duotone" width="20" height="20" style={{ color: '#6366f1' }} /> },
      { label: 'Nav Button', icon: <Icon icon="solar:arrow-right-bold-duotone" width="20" height="20" style={{ color: '#0d9488' }} /> }
    ] }
  ],
  reports: buildReportLeftToolPanels(),
  setup: [
    { items: [
      { label: 'Preferences', icon: <Icon icon="solar:settings-minimalistic-bold-duotone" width="20" height="20" style={{ color: '#3b82f6' }} />, primary: true, wide: true },
      { label: 'Units', icon: <Icon icon="solar:bolt-circle-bold-duotone" width="20" height="20" style={{ color: '#f59e0b' }} />, wide: true },
      { label: 'Styles', icon: <Icon icon="solar:palette-bold-duotone" width="20" height="20" style={{ color: '#ec4899' }} />, wide: true },
      { label: 'Image Manager', icon: <Icon icon="solar:gallery-bold-duotone" width="20" height="20" style={{ color: '#10b981' }} />, wide: true },
      { label: 'Calculated Variables', icon: <Icon icon="solar:calculator-bold-duotone" width="20" height="20" style={{ color: '#8b5cf6' }} />, wide: true },
      { label: 'Events', icon: <Icon icon="solar:bell-bing-bold-duotone" width="20" height="20" style={{ color: '#f59e0b' }} />, wide: true },
      { label: 'Engine Settings', icon: <Icon icon="solar:settings-bold-duotone" width="20" height="20" style={{ color: '#4b5563' }} />, wide: true },
      { label: 'Web Viewer Settings', icon: <Icon icon="solar:global-bold-duotone" width="20" height="20" style={{ color: '#06b6d4' }} />, wide: true }
    ] }
  ]
};

function Workspace({ active }: { active: AppModule }) {
  switch (active) {
    case 'file': return <FileWorkspace />;
    case 'devices': return <DevicesWorkspace />;
    case 'graphics': return <GraphicsEditor />;
    case 'reports': return <ReportsWorkspace />;
    case 'templates': return <TemplatesWorkspace />;
    case 'setup': return <SetupWorkspace />;
    default: return <FileWorkspace />;
  }
}

function leftTitle(active: AppModule) {
  return active === 'file' ? 'Project'
    : active === 'devices' ? 'Connections'
      : active === 'templates' ? 'Template Library'
        : active === 'graphics' ? 'Symbols'
          : active === 'reports' ? 'Report Tools'
            : 'Setup';
}

function rightProps(active: AppModule) {
  if (active === 'devices') return [
    ['Name', '-'],
    ['Protocol', '-'],
    ['Endpoint', '-'],
    ['Timeout', '-']
  ];
  if (active === 'graphics') return [
    ['Graphic', '-'],
    ['Tool', 'Pointer'],
    ['Grid', '20 px'],
    ['Binding', '-']
  ];
  if (active === 'reports') return [
    ['Report', '-'],
    ['Paper', '-'],
    ['Output', '-'],
    ['Source', 'Stored records']
  ];
  if (active === 'setup') return [
    ['Runtime', 'Not verified'],
    ['Timezone', 'Asia/Bangkok'],
    ['Web Viewer', 'Not configured'],
    ['Security', 'Not configured']
  ];
  return [
    ['Name', '-'],
    ['Customer', '-'],
    ['Database', 'Not verified'],
    ['Mode', 'Engineering']
  ];
}

function getModuleIcon(m: AppModule, isActive: boolean) {
  const map: Record<AppModule, { icon: string; activeColor: string; inactiveColor: string }> = {
    file: { icon: 'solar:document-bold-duotone', activeColor: '#38bdf8', inactiveColor: '#0ea5e9' },
    devices: { icon: 'solar:server-minimalistic-bold-duotone', activeColor: '#4ade80', inactiveColor: '#10b981' },
    graphics: { icon: 'solar:palette-bold-duotone', activeColor: '#fb7185', inactiveColor: '#ec4899' },
    reports: { icon: 'solar:chart-square-bold-duotone', activeColor: '#c084fc', inactiveColor: '#8b5cf6' },
    templates: { icon: 'solar:document-add-bold-duotone', activeColor: '#8b5cf6', inactiveColor: '#6366f1' },
    setup: { icon: 'solar:settings-minimalistic-bold-duotone', activeColor: '#fbbf24', inactiveColor: '#d97706' }
  };
  const config = map[m];
  return (
    <Icon
      icon={config.icon}
      width="18"
      height="18"
      style={{
        marginRight: 8,
        verticalAlign: 'middle',
        color: isActive ? config.activeColor : config.inactiveColor
      }}
    />
  );
}

function WindowControls() {
  const controls = typeof window !== 'undefined' ? window.energylink?.window : undefined;
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    if (!controls) return;
    void controls.isMaximized().then(setIsMax);
  }, [controls]);

  if (!controls) return null;

  return (
    <div className="window-controls" role="toolbar" aria-label="Window controls">
      <button type="button" className="win-btn" title="Minimize" onClick={() => controls.minimize()}>—</button>
      <button
        type="button"
        className="win-btn"
        title={isMax ? 'Restore' : 'Maximize'}
        onClick={() => {
          controls.maximize();
          void controls.isMaximized().then(setIsMax);
        }}
      >
        {isMax ? '❐' : '□'}
      </button>
      <button type="button" className="win-btn win-close" title="Close" onClick={() => controls.close()}>×</button>
    </div>
  );
}

export function App() {
  const [active, setActive] = useState<AppModule>('file');
  const [activeProjectName, setActiveProjectName] = useState<string>('-');
  const [showSidebars, setShowSidebars] = useState(false);
  const groups = useMemo(() => ribbonGroups[active], [active]);
  const leftGroups = useMemo(() => leftToolPanels[active], [active]);
  const hasSidebars = showSidebars && active !== 'graphics' && active !== 'reports';

  async function fetchActiveProject() {
    try {
      const db = await window.energylink.projects.status();
      if (db.activeProjectId) {
        const list = await window.energylink.projects.list();
        const activeProj = list.find(p => p.id === db.activeProjectId);
        if (activeProj) {
          setActiveProjectName(activeProj.name);
          return;
        }
      }
      setActiveProjectName('-');
    } catch (e) {
      console.error(e);
      setActiveProjectName('-');
    }
  }

  useEffect(() => {
    void fetchActiveProject();

    function handleProjectChange() {
      void fetchActiveProject();
    }

    function handleSwitchModule(e: Event) {
      const target = (e as CustomEvent<AppModule>).detail;
      if (modules.includes(target)) {
        setActive(target);
      }
    }

    window.addEventListener('energylink:active-project-changed', handleProjectChange);
    window.addEventListener('energylink:switch-module', handleSwitchModule);
    return () => {
      window.removeEventListener('energylink:active-project-changed', handleProjectChange);
      window.removeEventListener('energylink:switch-module', handleSwitchModule);
    };
  }, []);

  function runRibbonCommand(item: string) {
    dispatchEditorCommand(active, item);
  }

  return (
    <div className={`app-shell ${active === 'file' ? 'file-mode' : ''} ${active === 'graphics' || active === 'reports' ? 'designer-mode' : ''} ${active === 'graphics' ? 'graphics-mode' : ''} ${active === 'reports' ? 'reports-mode' : ''} ${active === 'devices' ? 'devices-mode' : ''} ${active === 'templates' ? 'templates-mode' : ''}`}>
      <header className="titlebar">
        <div className="brand">
          <span className="logo" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0f766e, #115e59)', border: '1px solid rgba(255, 255, 255, 0.2)', width: '28px', height: '28px', borderRadius: '50%', boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)' }}>
            <Icon icon="solar:bolt-bold-duotone" width="18" height="18" style={{ color: '#facc15' }} />
          </span>
          <b>EnergyLink</b>
          <span>Management Editor</span>
        </div>
        <div className="title-spacer" />
        <div className="title-chip">Project: <b>{activeProjectName}</b></div>
        <div className="title-chip">Access: <b>-</b></div>
        <button
          type="button"
          className={`title-chip title-chip-btn${showSidebars ? ' active' : ''}`}
          title="Toggle side panels (Reports, Devices, …)"
          onClick={() => setShowSidebars((v) => !v)}
        >
          Panels {showSidebars ? 'ON' : 'OFF'}
        </button>
        <WindowControls />
      </header>

      <nav className="menu-bar" aria-label="Editor modules">
        {modules.map((m) => (
          <button
            key={m}
            className={active === m ? 'active' : ''}
            onClick={() => setActive(m)}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {getModuleIcon(m, active === m)}
            {labels[m]}
          </button>
        ))}
      </nav>

      <section className="ribbon" aria-label={`${labels[active]} ribbon`}>
        {groups.map((group) => (
          <div className="ribbon-group" key={group.label}>
            <div className="ribbon-tools">
              {group.items.map((item) => (
                <button
                  className={`tool ${item.primary ? 'primary' : ''} ${item.wide ? 'wide' : ''}`}
                  key={`${group.label}-${item.label}`}
                  onClick={() => runRibbonCommand(item.label)}
                  title={`${labels[active]} / ${item.label}`}
                >
                  <span className="tool-icon">{item.icon}</span>
                  <span className="tool-text">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="ribbon-label">{group.label}</div>
          </div>
        ))}
      </section>

      <main className={`workspace ${!hasSidebars ? 'no-sidebars' : ''}`}>
        {hasSidebars && (
          <aside className="left-panel">
            <div className="panel-title"><span>{leftTitle(active)}</span><span className="panel-action">⏄</span></div>
            <div className={`panel-list ${(active as string) === 'reports' ? 'tool-panel-list' : ''}`}>
              {leftGroups.map((group, groupIndex) => (
                <section className="left-tool-section" key={`${active}-${group.title ?? groupIndex}`}>
                  {group.title && <div className="tool-section-title">{group.title}</div>}
                  <div className={(active as string) === 'reports' ? 'left-tool-grid' : 'left-tree-list'}>
                    {group.items.map((item, itemIndex) => (
                      <button
                        key={`${group.title ?? 'main'}-${item.label}`}
                        className={`left-tool ${item.primary ? 'active' : ''} ${item.wide ? 'wide' : ''}`}
                        onClick={() => runRibbonCommand(item.label)}
                        title={`${labels[active]} / ${item.label}`}
                      >
                        <span>{item.icon}</span>
                        <b>{item.label}</b>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        )}

        <section className="main-area"><Workspace active={active} /></section>

        {hasSidebars && (
          <aside className="right-panel">
            <div className="panel-title"><span>Properties</span><span className="panel-action">PIN x</span></div>
            <div className="props">
              <div className="prop-section">
                <div className="prop-title">{labels[active]} Properties</div>
                {rightProps(active).map(([label, value]) => (
                  <label key={label}>{label}<input value={value} readOnly /></label>
                ))}
              </div>
              <div className="prop-section">
                <div className="prop-title">Status</div>
                <div className="prop-row"><span>Engine</span><b className="pill unknown">Unknown</b></div>
                <div className="prop-row"><span>Database</span><b className="pill unknown">Unknown</b></div>
              </div>
            </div>
          </aside>
        )}
      </main>

      <EditorStatusBar />
    </div>
  );
}

export default App;
