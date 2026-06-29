# ENL Management - Function Completion Round 10

Round 10 focuses on Editor to Engine API integration.

## Run

```powershell
pnpm install
pnpm db:generate
pnpm dev:engine
pnpm dev:editor
```

## Notes

Editor uses Engine API first when Engine is reachable at `http://localhost:8080`. If the Engine is not reachable, Editor falls back to local working mode so the UI can still open and edit project screens without creating runtime data.

No login, user password, simulator, or generated runtime value was added.
