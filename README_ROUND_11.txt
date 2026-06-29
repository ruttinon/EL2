EnergyLink Management - Function Completion Round 11

This package continues from Round 10 and focuses on Web Viewer Runtime Completion.

Main points:
- No Login
- No User / Password
- No Role Gate
- Web Viewer connects to real Engine API
- Start / Stop Polling buttons call Engine runtime API
- Read Once calls Engine manual read-cycle API
- Alarm acknowledge calls Engine alarm API
- Reports generate through Engine report API
- Graphics render saved layouts and current values from Engine only
- No generated runtime values are created by Web Viewer

Run:
1. pnpm install
2. pnpm db:generate
3. pnpm dev:engine
4. pnpm dev:web
5. Open http://localhost:5175
