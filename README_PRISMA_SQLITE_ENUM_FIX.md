# EnergyLink Prisma SQLite Enum Fix

Prisma SQLite does not support enum declarations. If `pnpm db:generate` fails with `current connector does not support enums`, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\APPLY_PRISMA_SQLITE_ENUM_FIX.ps1
pnpm db:generate
pnpm build
```

The script:

- backs up `prisma/schema.prisma`
- converts enum-typed fields to `String`
- removes unsupported enum blocks
- keeps default string values such as `@default("active")` intact

Run the script from the project root.
