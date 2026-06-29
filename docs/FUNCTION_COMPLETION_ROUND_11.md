# Function Completion Round 11 - Web Viewer Runtime Completion

## Scope
Round 11 focuses on the Web Viewer runtime workflow. The Web Viewer now connects directly to the EnergyLink Engine API using local open access. It does not use login, user accounts, passwords, or role gates.

## Completed behavior

- Web Viewer opens without authentication.
- Engine URL can be edited and saved from the toolbar.
- Manual Refresh loads status, runtime, devices, tags, graphics, alarms, reports, and generated files.
- Auto Refresh can be enabled or disabled.
- Start Polling calls the Engine runtime polling API.
- Stop Polling calls the Engine runtime polling API.
- Read Once calls the Engine manual read-cycle API.
- Dashboard shows live counts from Engine API responses.
- Graphics Viewer lists graphics from Engine and renders saved graphic layout objects.
- Bound graphic objects display current values from `/api/tags/current` only.
- Trend Viewer lists tags and displays history from `/api/trend`.
- Alarm Viewer lists Engine alarms and can acknowledge alarms through Engine API.
- Report Viewer lists report templates, generates PDF/Excel through Engine API, and lists generated files.
- Device Status lists configured devices and tag counts from SQLite via Engine.

## Runtime data rule

The Web Viewer does not generate device values, trend points, alarms, or report data. If the Engine has not read a real configured device, the UI shows empty state, `--`, `unknown`, or `No data`.

## Files changed

- `apps/web-viewer/src/App.tsx`
- `apps/web-viewer/src/api/engineApi.ts`
- `apps/web-viewer/src/styles/web-viewer.css`

## Verification

Audit result:

```text
PASS
FAIL: 0
```

## Run commands

```powershell
pnpm install
pnpm db:generate
pnpm dev:engine
pnpm dev:web
```

Open:

```text
http://localhost:5175
```
