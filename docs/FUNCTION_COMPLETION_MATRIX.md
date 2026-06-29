# EnergyLink Button Function Completion Matrix

## Round 4 Status

| Area | Button | Status | Behavior |
|---|---|---|---|
| Devices | Connections | Complete | Validates selected device communication configuration without changing runtime state. |
| Devices | Groups | Complete | Shows converter, meter, and sensor counts from the actual device list. |
| Devices | Devices | Complete | Refreshes and focuses the device list. |
| Devices | Add Converter | Complete | Opens converter form for real save. |
| Devices | Add Meter | Complete | Opens meter form and requires parent converter. |
| Devices | Add Tag | Complete | Opens tag form and binds selected device when available. |
| Devices | Tag List | Complete | Refreshes and focuses tag list. |
| Devices | Modify | Complete | Validates and updates selected device or tag. |
| Devices | Delete | Complete | Confirms and deletes selected device or tag. |
| Devices | Expand | Complete | Expands device tree. |
| Devices | Collapse | Complete | Collapses device tree. |

## Remaining Rounds

- Round 5: Graphics Designer object operations.
- Round 6: Report Designer output operations.
- Round 7: Monitor runtime viewer and Engine API alignment.

## Round 5 - Graphics Designer Completion

| Area | Function | Status |
|---|---|---|
| Graphics | New Graphic | Completed with validation |
| Graphics | Save Graphic | Completed with validation and persistence |
| Graphics | Delete Graphic | Completed with confirmation |
| Graphics | Set Default | Completed |
| Graphics | Object Tools | Completed with active tool placement |
| Graphics | Text/Image/Value/Gauge/Trend/Alarm/Line/Rectangle/Button | Completed as real canvas objects |
| Graphics | Drag object | Completed |
| Graphics | Grid 20px | Completed |
| Graphics | Bind Tag | Completed using real tag list only |
| Graphics | Duplicate Object | Completed |
| Graphics | Delete Object | Completed |
| Graphics | Layer front/back | Completed |
| Graphics | Align object | Completed |
| Graphics | Style properties | Completed |
| Graphics | Export JSON | Completed |
| Graphics | Runtime values | No fake values; real Engine data only |

## Round 6 - Reports Designer

| Area | Function | Status |
| --- | --- | --- |
| Reports | New Report | Completed |
| Reports | Save Report | Completed |
| Reports | Delete Report | Completed |
| Reports | Set Default | Completed |
| Reports | Validate | Completed |
| Reports | Preview | Completed |
| Reports | Page Setup | Completed |
| Reports | Export PDF | Completed as print-ready HTML for Windows Print to PDF |
| Reports | Export Excel | Completed as Excel-compatible CSV |
| Reports | Print | Completed |
| Reports | Add Text/Image/Date/Formula/Table/Graph/Summary Objects | Completed |
| Reports | Object Properties | Completed |
| Reports | Object Drag / Keyboard Move / Duplicate / Layer / Lock | Completed |
| Reports | Scheduler Create / Run / Enable / Delete | Completed through local Engine API |


## Round 7 - Setup Workspace

| Area | Function | Status |
| --- | --- | --- |
| Runtime | Validate runtime configuration | Completed |
| Runtime | Save runtime configuration | Completed |
| Units | Save unit and cost defaults | Completed |
| Styles | Save style defaults | Completed |
| Images | Import image files | Completed |
| Images | Delete imported image | Completed |
| Calculated Variables | Create/edit/delete formulas | Completed |
| Events | Create sound channel and alarm rule through Engine API | Completed |
| Web Viewer | Save web viewer settings and open viewer | Completed |
| Database | Check Engine/database status | Completed |
| Backup | Create Engine backup or local setup backup | Completed |
| Backup | Restore/delete local setup backup | Completed |
| Maintenance | Run Engine maintenance or local retention cleanup | Completed |

## Round 8 - Monitor Runtime Completion

| Area | Function | Status |
| --- | --- | --- |
| Monitor | Connect Engine API | Completed |
| Monitor | Manual Refresh | Completed |
| Monitor | Auto Refresh | Completed |
| Monitor | Start Polling | Completed |
| Monitor | Stop Polling | Completed |
| Monitor | Dashboard runtime status | Completed |
| Monitor | Graphics runtime viewer | Completed |
| Monitor | Bound tag value display | Completed |
| Monitor | Trend tag selection | Completed |
| Monitor | Trend history table | Completed |
| Monitor | Alarm list | Completed |
| Monitor | Alarm acknowledge | Completed |
| Monitor | Report generation | Completed |
| Monitor | Generated report listing | Completed |
| Monitor | Device status table | Completed |


## Round 10 - Editor to Engine API Integration

| Area | Function | Status | Notes |
|---|---|---:|---|
| Editor Data Bridge | Engine API first | Done | Uses Engine API when reachable. |
| Editor Data Bridge | Offline local working mode | Done | Used only when Engine is offline. |
| Project | CRUD via Engine API | Done | Create/update/delete/list use `/api/projects`. |
| Device | CRUD via Engine API | Done | Create/update/delete/list use Engine routes. |
| Tag | CRUD via Engine API | Done | Added `/api/editor/tags` for list and by-device lookup. |
| Graphics | CRUD via Engine API | Done | Uses `/api/graphics`. |
| Reports | CRUD via Engine API | Done | Uses `/api/reports`. |
| Runtime Data | No generated values | Enforced | Runtime data remains Engine/device-read only. |

## Round 11 - Web Viewer Runtime Completion

| Area | Function | Status |
|---|---|---|
| Web Viewer | Open without Login | Completed |
| Web Viewer | Engine URL edit/apply | Completed |
| Web Viewer | Manual Refresh | Completed |
| Web Viewer | Auto Refresh on/off | Completed |
| Runtime | Start Polling | Completed |
| Runtime | Stop Polling | Completed |
| Runtime | Read Once | Completed |
| Dashboard | Engine status / runtime counters | Completed |
| Graphics | Load saved graphics from Engine | Completed |
| Graphics | Render graphic objects | Completed |
| Graphics | Bound values from Engine current values | Completed |
| Trend | Load tag list and history | Completed |
| Alarm | Load Engine alarms | Completed |
| Alarm | Acknowledge Alarm | Completed |
| Report | Generate PDF / Excel through Engine | Completed |
| Report | List generated files | Completed |
| Devices | List devices and tag counts | Completed |
