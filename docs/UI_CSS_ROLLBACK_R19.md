# UI CSS Rollback R19

This patch restores `apps/editor-desktop/src/styles/editor.css` to the stable R17 separator-fix version.

Purpose:
- Fix screen layout broken by R18 CSS changes.
- Keep Start logic from R18 if FileWorkspace.tsx was already applied.
- Do not change TypeScript logic.
- Do not change Engine, Database, API, Monitor, Web Viewer, or command logic.

Files included:
- apps/editor-desktop/src/styles/editor.css
