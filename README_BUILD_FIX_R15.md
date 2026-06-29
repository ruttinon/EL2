# EnergyLink Build Fix R15

This patch fixes the TypeScript build error in:

`apps/engine-manager-desktop/electron/main.ts`

The original code returned `error.errno` directly, which TypeScript sees as `number | undefined`. The build expects `number | null`.

The patch converts it to:

```ts
const errno = (error as NodeJS.ErrnoException | null)?.errno;
const code: number | null = typeof errno === 'number' ? errno : null;
```

It also re-saves `prisma/schema.prisma` as UTF-8 without BOM to avoid Prisma schema encoding issues.

## Usage

Copy `APPLY_BUILD_FIX_R15.ps1` to your project root and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\APPLY_BUILD_FIX_R15.ps1
pnpm db:generate
pnpm build
```
