# EnergyLink Function Completion Round 4

## Scope

Round 4 completes the Devices workspace workflow for local open operation.

## Completed

- Device ribbon commands now execute meaningful actions.
- Connections validates the selected device communication configuration.
- Groups shows device counts by converter, meter, and sensor.
- Devices refreshes and focuses the device list.
- Add Converter opens the converter form.
- Add Meter opens the meter form and selects the first converter when available.
- Add Tag focuses the tag form and assigns the selected device when available.
- Tag List refreshes and focuses the tag list.
- Modify validates and updates the selected device or selected tag.
- Delete asks for confirmation and deletes the selected device or tag.
- Expand opens every device tree branch.
- Collapse closes every device tree branch.

## Data Rules

- No generated runtime values.
- No automatic online status.
- New device status remains unknown until the Engine reads the real device.
- Tag current value remains null until the Engine reads the real device.
- Duplicate device names are rejected.
- Duplicate tag names in the same device are rejected.
- Meter and sensor require a parent converter.
- Converter cannot be placed under another converter.
- Modbus TCP and Modbus RTU settings are validated before save.

## Files Updated

- apps/editor-desktop/src/features/devices/DevicesWorkspace.tsx
- apps/editor-desktop/src/localEnergylink.ts
- docs/FUNCTION_COMPLETION_MATRIX.md
