; EnergyLink Management Inno Setup script
; Build after running: pnpm build:release
; This script installs Editor, Monitor, Engine, WebViewer and registers the Engine Windows Service.

#define MyAppName "EnergyLink Management"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "EnergyLink"
#define LayoutRoot "..\..\release\install-layout"
#define ProgramFilesLayout LayoutRoot + "\Program Files\EnergyLink Management"
#define ProgramDataLayout LayoutRoot + "\ProgramData\EnergyLink Management"

[Setup]
AppId={{6A33BBE1-4ED7-4F64-95E3-ENERGYLINK014}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\EnergyLink Management
DefaultGroupName=EnergyLink Management
DisableProgramGroupPage=yes
OutputDir=..\..\release\installer
OutputBaseFilename=EnergyLinkManagement_Setup_v1_0_0
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern

[Files]
Source: "{#ProgramFilesLayout}\Editor\*"; DestDir: "{app}\Editor"; Flags: recursesubdirs ignoreversion
Source: "{#ProgramFilesLayout}\Monitor\*"; DestDir: "{app}\Monitor"; Flags: recursesubdirs ignoreversion
Source: "{#ProgramFilesLayout}\EngineManager\*"; DestDir: "{app}\EngineManager"; Flags: recursesubdirs ignoreversion
Source: "{#ProgramFilesLayout}\Engine\*"; DestDir: "{app}\Engine"; Flags: recursesubdirs ignoreversion
Source: "{#ProgramFilesLayout}\WebViewer\*"; DestDir: "{app}\WebViewer"; Flags: recursesubdirs ignoreversion
Source: "{#ProgramDataLayout}\config\engine.json"; DestDir: "{commonappdata}\EnergyLink Management\config"; Flags: onlyifdoesntexist
Source: "{#ProgramDataLayout}\data\*"; DestDir: "{commonappdata}\EnergyLink Management\data"; Flags: recursesubdirs onlyifdoesntexist
Source: "{#ProgramDataLayout}\drivers\*"; DestDir: "{commonappdata}\EnergyLink Management\drivers"; Flags: recursesubdirs onlyifdoesntexist
Source: "..\scripts\install-windows.ps1"; DestDir: "{app}\installer\scripts"; Flags: ignoreversion
Source: "..\scripts\uninstall-windows.ps1"; DestDir: "{app}\installer\scripts"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\EnergyLink Management\config"
Name: "{commonappdata}\EnergyLink Management\data"
Name: "{commonappdata}\EnergyLink Management\drivers"
Name: "{commonappdata}\EnergyLink Management\logs"
Name: "{commonappdata}\EnergyLink Management\graphics"
Name: "{commonappdata}\EnergyLink Management\reports"
Name: "{commonappdata}\EnergyLink Management\images"
Name: "{commonappdata}\EnergyLink Management\backups"

[Icons]
Name: "{autodesktop}\EnergyLink Editor"; Filename: "{app}\Editor\EnergyLink Editor.exe"; WorkingDir: "{app}\Editor"; Check: FileExists(ExpandConstant('{app}\Editor\EnergyLink Editor.exe'))
Name: "{autodesktop}\EnergyLink Monitor"; Filename: "{app}\Monitor\EnergyLink Monitor.exe"; WorkingDir: "{app}\Monitor"; Check: FileExists(ExpandConstant('{app}\Monitor\EnergyLink Monitor.exe'))
Name: "{group}\EnergyLink Editor"; Filename: "{app}\Editor\EnergyLink Editor.exe"; WorkingDir: "{app}\Editor"; Check: FileExists(ExpandConstant('{app}\Editor\EnergyLink Editor.exe'))
Name: "{group}\EnergyLink Monitor"; Filename: "{app}\Monitor\EnergyLink Monitor.exe"; WorkingDir: "{app}\Monitor"; Check: FileExists(ExpandConstant('{app}\Monitor\EnergyLink Monitor.exe'))
Name: "{group}\EnergyLink Engine Manager"; Filename: "{app}\EngineManager\EnergyLink Engine Manager.exe"; WorkingDir: "{app}\EngineManager"; Check: FileExists(ExpandConstant('{app}\EngineManager\EnergyLink Engine Manager.exe'))
Name: "{group}\Uninstall EnergyLink Management"; Filename: "{uninstallexe}"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\installer\scripts\install-windows.ps1\" -SourceRoot \"{src}\release\install-layout\""; Flags: runhidden waituntilterminated; StatusMsg: "Registering EnergyLink Engine Service..."

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\installer\scripts\uninstall-windows.ps1\""; Flags: runhidden waituntilterminated
