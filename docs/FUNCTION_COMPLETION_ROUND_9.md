# Function Completion Round 9 - Engine Real Runtime API Completion

## Goal

Round 9 completes the Engine-side API foundation so Editor, Monitor, and Web Viewer can use the same SQLite-backed local Engine service instead of relying only on local UI state.

## Completed

- Added Project CRUD API.
- Added Device create/update/delete API.
- Added Tag create/update/delete API.
- Added Graphic create/update/delete/set-default API.
- Added Report create/update/delete/set-default API.
- Added manual runtime read-cycle API.
- Kept runtime reads tied to configured communication drivers only.
- Kept current values as null/unknown until a configured physical device read succeeds.
- Kept history and alarm generation tied to actual Engine reads only.
- Added validation for project, device, tag, graphic, and report writes.
- Added Engine logs for data changes.

## API added or completed

```text
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id

POST   /api/devices
PUT    /api/devices/:id
DELETE /api/devices/:id

POST   /api/tags
PUT    /api/tags/:id
DELETE /api/tags/:id

POST   /api/graphics
PUT    /api/graphics/:id
POST   /api/graphics/:id/set-default
DELETE /api/graphics/:id

POST   /api/reports
PUT    /api/reports/:id
POST   /api/reports/:id/set-default
DELETE /api/reports/:id

POST   /api/runtime/read-cycle
```

## Runtime rule

No generated device values are added. The Engine updates tag current values, history, and alarms only from configured device communication driver reads.

## Next recommended round

Round 10 should connect Editor workspaces directly to these Engine APIs with a local fallback only when the Engine is not running.
