EnergyLink Prisma SQLite UTF-8 + Enum Fix

Use this if pnpm db:generate fails with:
- current connector does not support enums
- generator client line is invalid

Steps:
1. Copy APPLY_PRISMA_SCHEMA_UTF8_ENUM_FIX.ps1 to the project root folder.
2. Open PowerShell at the project root.
3. Run:

   Set-ExecutionPolicy -Scope Process Bypass
   .\APPLY_PRISMA_SCHEMA_UTF8_ENUM_FIX.ps1
   pnpm db:generate
   pnpm build

The script backs up prisma/schema.prisma before changing it.
