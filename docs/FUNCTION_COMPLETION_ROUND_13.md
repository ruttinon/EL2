# Function Completion Round 13 - Final Local QA / Broken Button Coverage

## Goal

Round 13 adds a local QA check for Editor ribbon command coverage and updates the local run package so the project can be checked before opening the application.

## What changed

- Added `scripts/check-function-coverage.mjs`.
- Added `pnpm qa:functions`.
- Added `pnpm qa:local`.
- Added `QA_LOCAL_FUNCTIONS.cmd` for Windows users.
- Verified that 50 Editor ribbon commands have matching command handlers.
- Updated Editor footer to show Function Completion Round 13.

## Important rule

This round does not add login, user, password, role gate, generated runtime values, or device simulation. Runtime values must still come from real Engine/device reads only.

## Commands checked

The QA script checks the following Editor ribbon groups:

- File
- Devices
- Graphics
- Reports
- Setup

The script writes reports to:

```text
release/qa/function-coverage.md
release/qa/function-coverage.json
```

## How to run QA

```powershell
pnpm qa:local
```

Or double-click:

```text
QA_LOCAL_FUNCTIONS.cmd
```

Expected result:

```text
Unhandled commands: 0
```
