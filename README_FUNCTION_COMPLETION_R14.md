# EnergyLink Management - Function Completion Round 14

## Run QA

```powershell
pnpm install
pnpm db:generate
pnpm qa:local
pnpm build
```

Or run:

```text
QA_BUILD.cmd
```

## What this round adds

- Build QA script
- Local QA script update
- No-login entry-point check
- Workspace script check
- Editor command route check
- Source scan for blocked runtime patterns

## Result from package audit

```text
Project audit: FAIL 0
Function coverage: Unhandled commands 0
Build QA: FAIL 0
```
