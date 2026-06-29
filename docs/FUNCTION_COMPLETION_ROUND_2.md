# EnergyLink Management - Function Completion Round 2

## Purpose
Round 2 focuses on making the Editor open without login and removing the fragile first-screen dependency on `@energylink/shared-types` for the main application shell.

## Completed in Round 2
- Editor starts with local open access.
- No LoginGate in Editor shell.
- No user/password screen in Editor shell.
- Removed `AppModule` import from `@energylink/shared-types` in `App.tsx`.
- Removed `AppModule` import from `@energylink/shared-types` in `commandBus.ts`.
- Ribbon commands remain dispatched through the command bus.
- App shell no longer blocks first-screen rendering because of shared package resolution.

## Important Runtime Rule
No simulator, fake values, random values, demo database, seeded data, or generated runtime values are added in this round.

If Engine is not connected, UI must show empty state or not-connected status. It must not invent runtime values.
