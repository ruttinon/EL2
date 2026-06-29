# Function Completion Round 10 - Editor to Engine API Integration

## Goal
Round 10 connects the Editor runtime bridge to the real Engine API when the Engine is running, while keeping local storage only as an offline working mode for opening and editing screens when the Engine is not available.

## Completed

- Added `apps/editor-desktop/src/engineApiBridge.ts`.
- Updated `apps/editor-desktop/src/main.tsx` to install the Engine-backed bridge after the local bridge.
- Editor now uses Engine API first for:
  - Projects
  - Devices
  - Tags
  - Graphics
  - Reports
- Added Engine route `GET /api/editor/tags` for Editor tag list and tag-by-device lookup.
- Kept Electron packaged mode on existing IPC/SQLite service path.
- Kept local store as offline mode only when Engine API is not reachable.

## API Used by Editor

- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/devices`
- `POST /api/devices`
- `PUT /api/devices/:id`
- `DELETE /api/devices/:id`
- `GET /api/editor/tags`
- `POST /api/tags`
- `PUT /api/tags/:id`
- `DELETE /api/tags/:id`
- `GET /api/graphics`
- `GET /api/graphics/:id`
- `POST /api/graphics`
- `PUT /api/graphics/:id`
- `DELETE /api/graphics/:id`
- `GET /api/reports`
- `GET /api/reports/:id`
- `POST /api/reports`
- `PUT /api/reports/:id`
- `DELETE /api/reports/:id`

## Runtime Data Rule

This round does not create meter values, alarm values, trend values, or report data. Current values, history, alarms, and runtime status must still come only from Engine reads from configured real devices.

## Explicitly Not Added

- No Login
- No User / Password
- No Role Gate
- No sample runtime value
- No generated meter value
- No generated alarm
- No generated trend
- No generated report data

## Test Commands

```powershell
pnpm install
pnpm db:generate
pnpm dev:engine
pnpm dev:editor
```

Use Editor with Engine running to write data to the Engine database. If the Engine is stopped, Editor stays usable in offline local working mode and clearly does not create runtime values.
