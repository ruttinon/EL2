# EnergyLink UI Blueprint Visual Patch R16

This patch updates only the Editor UI shell files to align the React application with the HTML blueprint mockup.

Changed files:

- apps/editor-desktop/src/App.tsx
- apps/editor-desktop/src/styles/editor.css

Main changes:

- SCADA-style teal title bar and menu bar
- Ribbon groups with icon tools, labels, and primary tool state
- Left framed tool panels for Graphics and Reports like the blueprint
- Project / Devices / Setup left panels styled like the mockup
- Right Properties panel styled like the mockup
- Status bar aligned with the blueprint style
- No login, no user/password gate, no simulator, no fake runtime values

Apply by extracting this zip over the project root, then run:

```powershell
pnpm dev:editor
```

For build validation:

```powershell
pnpm build
```
