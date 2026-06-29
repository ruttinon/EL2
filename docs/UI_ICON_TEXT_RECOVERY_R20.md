# UI Icon/Text Recovery R20

This patch fixes the Editor ribbon and left panel visual breakage caused by text abbreviations such as HOME, NEW, PRJ, INFO being rendered as oversized icons.

Changed files only:

- apps/editor-desktop/src/App.tsx
- apps/editor-desktop/src/styles/editor.css

Notes:

- No Engine logic changed.
- No database logic changed.
- No button command logic changed.
- CSS layout is not rebuilt; only final override rules were added to control icon and label sizing.
