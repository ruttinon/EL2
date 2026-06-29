# Function Completion Round 12 - Local Run Simplification

Round 12 focuses on making EnergyLink Management easy to run locally without using installer or Windows service steps.

## Goals

- Run Editor quickly.
- Run Engine quickly.
- Run Monitor quickly.
- Run Web Viewer quickly.
- Provide simple Windows command files at project root.
- Avoid the previous release-build workflow for normal UI testing.

## New root command files

- `START_EDITOR.cmd`
- `START_ENGINE.cmd`
- `START_MONITOR.cmd`
- `START_WEB_VIEWER.cmd`
- `START_LOCAL_EDITOR_WITH_ENGINE.cmd`

## New PowerShell tools

- `tools/windows/start-editor.ps1`
- `tools/windows/start-engine.ps1`
- `tools/windows/start-monitor.ps1`
- `tools/windows/start-web-viewer.ps1`
- `tools/windows/start-energylink-local.ps1`
- `tools/windows/check-local-ready.ps1`

## New package scripts

```powershell
pnpm check:local
pnpm start:local
pnpm start:engine
pnpm start:editor
pnpm start:monitor
pnpm start:web-viewer
```

## Recommended local run

First time only:

```powershell
pnpm install
pnpm db:generate
```

Then run:

```powershell
pnpm start:local
```

This opens Engine and Editor in separate PowerShell windows.

## Requirements retained

- No Login.
- No User / Password.
- No Role Gate.
- No runtime sample generator.
- No Meter value generation.
- No Alarm generation without real Engine data.
- No Trend generation without real History data.
