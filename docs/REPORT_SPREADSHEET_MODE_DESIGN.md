# Spreadsheet Report Mode Design

## Goal

Add a second report-authoring mode for users who want to:

- import an `xlsx` or `csv` file as a report template,
- bind EnergyLink values/tools into specific cells,
- export the resolved result as `xlsx`,
- export the same resolved result as `pdf`.

This mode should coexist with the current canvas-style report designer. It should not replace it.

## Current Baseline

The current report stack already provides good extension points:

- `prisma/schema.prisma`
  - `Report.templateJson` already stores report-specific layout state.
- `apps/editor-desktop/editor-desktop/src/features/reports/ReportsWorkspace.tsx`
  - current editor UI, preview flow, validation flow, and export actions live here.
- `apps/engine/src/routes/reportsRoutes.ts`
  - current report CRUD and `/generate` endpoint live here.
- `apps/engine/src/services/reportGenerationService.ts`
  - current PDF/Excel generation exists and already uses `exceljs` and `pdfkit`.
- `packages/shared-data/src/paths.ts`
  - already provides report-specific storage roots under ProgramData.

Important observation: the current implementation is object/canvas based. It is not cell-template based. Excel export currently generates workbook sheets from report data, but not from an imported workbook template.

## Recommended Approach

Introduce a new report mode:

- `canvas`
- `spreadsheet`

`canvas` remains the current behavior.

`spreadsheet` is a workbook-template workflow where the source of truth is an imported workbook/grid plus a binding map.

This is the correct model for the user's requirement because:

- the mental model is cell-based, not absolute-position object layout,
- imported Excel styling, merged cells, column widths, and sheet tabs matter,
- exporting back to Excel should preserve the workbook structure.

Trying to convert Excel into canvas objects would lose too much structure and create unnecessary complexity.

## UX Design

### 1. Entry Flow

In `ReportsWorkspace`, add a report mode selector near the report metadata area:

- `Canvas Report`
- `Spreadsheet Report`

When the user picks `Spreadsheet Report`, show:

- `Import Excel`
- `Import CSV`
- `Start Blank Grid`

### 2. Spreadsheet Editor Layout

Reuse the existing three-column workspace pattern:

- Left panel
  - workbook actions
  - sheet list
  - cell tools
  - named bindings list
- Center panel
  - spreadsheet grid preview
  - formula bar / token editor
  - sheet tabs
- Right panel
  - selected cell info
  - binding inspector
  - format options
  - export options

### 3. Cell Binding Workflow

User flow:

1. import workbook or CSV,
2. click a cell,
3. choose a tool/value source,
4. configure the binding,
5. preview resolved value,
6. export to Excel or PDF.

### 4. Cell Tool Types

Start with a small, high-value set:

- `report_meta`
  - report name
  - generated at
  - period start
  - period end
  - project name
- `tag_metric`
  - latest
  - first
  - last
  - min
  - max
  - avg
  - usage
- `billing_metric`
  - total kWh
  - energy cost
  - demand cost
  - grand total
- `formula`
  - EnergyLink expression using existing report formula helpers
- `text_template`
  - tokenized text such as `Total {{billing.grandTotal}} THB`

This is enough for v1 without trying to bring the full canvas widget palette into a cell editor.

## Data Model

### Report Template JSON

Do not replace `Report.templateJson`. Extend it.

Recommended root structure:

```json
{
  "version": 2,
  "mode": "spreadsheet",
  "spreadsheet": {
    "source": {
      "kind": "xlsx",
      "relativePath": "templates/report_<reportId>/source.xlsx",
      "originalFileName": "monthly_report.xlsx",
      "uploadedAt": "2026-06-28T12:00:00.000Z"
    },
    "snapshot": {
      "sheets": [
        {
          "id": "sheet_1",
          "name": "Summary",
          "rowCount": 40,
          "colCount": 12,
          "usedRange": "A1:L40",
          "columns": [{ "index": 1, "width": 20 }],
          "rows": [{ "index": 1, "height": 24 }],
          "merges": ["A1:D1"]
        }
      ]
    },
    "bindings": [
      {
        "id": "bind_1",
        "sheetName": "Summary",
        "cell": "B4",
        "kind": "tag_metric",
        "config": {
          "tagId": "tag_main_kwh",
          "metric": "usage"
        },
        "format": {
          "decimalPlaces": 2,
          "suffix": " kWh"
        },
        "fallbackText": "-"
      }
    ],
    "export": {
      "pdf": {
        "sheetMode": "all",
        "fitToPage": true,
        "showGridLines": false
      },
      "excel": {
        "preserveFormulas": true
      }
    }
  }
}
```

### Asset Storage

Do not store workbook binary inside `templateJson`.

Recommended storage:

- original file saved under ProgramData report storage,
- reference it from `templateJson.spreadsheet.source.relativePath`.

Suggested new helper:

- `getReportTemplatesDir()` under `packages/shared-data/src/paths.ts`

Suggested storage layout:

- `reports/templates/<reportId>/source.xlsx`
- `reports/templates/<reportId>/snapshot.json` only if snapshot becomes too large for `templateJson`

### Why This Shape

This keeps the DB impact low:

- no immediate schema migration is required for v1,
- existing report CRUD can continue to work,
- `templateJson` stays the extension point,
- file system stores the heavy binary asset.

If later the team needs report-template versioning or multi-asset attachments, add a dedicated `ReportAsset` table in phase 2.

## Engine/API Design

### New/Extended Routes

Extend `apps/engine/src/routes/reportsRoutes.ts`.

#### Import spreadsheet template

`POST /api/reports/:id/import-spreadsheet`

Body:

```json
{
  "filename": "monthly-template.xlsx",
  "dataBase64": "...",
  "kind": "xlsx"
}
```

Behavior:

- validate extension: `xlsx`, `csv`,
- save source file under the report template folder,
- parse workbook or CSV,
- build a lightweight UI snapshot,
- update `Report.templateJson` to `mode: "spreadsheet"`,
- return the updated report runtime payload.

#### Resolve spreadsheet preview

`POST /api/reports/:id/resolve-spreadsheet-preview`

Body:

```json
{
  "from": "2026-06-01T00:00:00.000Z",
  "to": "2026-06-30T23:59:59.999Z",
  "tariffId": "..."
}
```

Behavior:

- load the spreadsheet template,
- resolve all bindings,
- return a preview payload for the editor grid without writing files.

#### Reuse current export route

Keep:

- `POST /api/reports/:id/generate`

Extend behavior:

- if `template.mode !== "spreadsheet"`, keep current canvas flow,
- if `template.mode === "spreadsheet"`, use spreadsheet export flow.

This keeps the UI export action stable.

### Engine Service Changes

Split the current generator into two flows:

- `generateCanvasReport(...)`
- `generateSpreadsheetReport(...)`

`generateReport(...)` becomes a dispatcher.

Suggested new service files:

- `apps/engine/src/services/reportSpreadsheetTemplateService.ts`
  - parse import files
  - build/save snapshots
  - load workbook source
- `apps/engine/src/services/reportSpreadsheetBindingService.ts`
  - collect tag IDs and billing dependencies
  - resolve bindings into cell values
  - reuse existing formula helpers from `@energylink/shared-types`
- `apps/engine/src/services/reportSpreadsheetExportService.ts`
  - write resolved workbook to Excel
  - render resolved workbook to PDF

### Resolution Rules

Each binding should resolve to one of:

- raw text,
- raw number,
- Excel formula string,
- rich text later, not in v1.

Suggested binding modes:

- `replace_value`
  - overwrite target cell value
- `replace_formula`
  - write an Excel formula string to the cell
- `token_merge`
  - replace `{{...}}` tokens inside existing cell text

`token_merge` is useful for labels such as:

- `Energy for {{report.periodLabel}}`
- `Total: {{billing.grandTotal}} THB`

### Excel Export

This is the easy part and should be the primary export path.

Flow:

1. load source workbook with `exceljs`,
2. clone workbook structure,
3. resolve bindings,
4. write resolved values into cells,
5. preserve workbook styling, widths, merges, and existing formulas where possible,
6. save `.xlsx`.

CSV imports should be normalized into a single-sheet workbook internally, then exported as `.xlsx`.

### PDF Export

This is the main technical risk.

Exact Excel-to-PDF fidelity is hard because:

- `exceljs` does not calculate workbook formulas,
- `pdfkit` is not a spreadsheet renderer,
- imported workbooks may contain merges, styles, formulas, and print areas.

Recommended v1 behavior:

- support static styles, row heights, column widths, merges, alignment, fill color, border, and wrap text,
- render each sheet as a paginated table to PDF,
- explicitly document that advanced Excel features are not guaranteed in PDF v1.

If the workbook relies on native Excel formulas, choose one of these paths:

1. preferred phase-2 path: add a formula engine such as `HyperFormula` for preview/PDF calculation,
2. fallback v1 path: preserve formulas in exported Excel, but PDF only guarantees direct bound values and token text.

This tradeoff should be accepted early. The user requirement is fully feasible, but PDF parity with arbitrary Excel workbooks is the non-trivial part.

## Editor Changes

### ReportsWorkspace

In `apps/editor-desktop/editor-desktop/src/features/reports/ReportsWorkspace.tsx`:

- add report mode switch,
- add spreadsheet import actions,
- render a spreadsheet editor view when `template.mode === "spreadsheet"`,
- keep current designer untouched for `canvas`.

Suggested new components:

- `SpreadsheetReportWorkspace.tsx`
- `SpreadsheetGrid.tsx`
- `SpreadsheetSheetTabs.tsx`
- `SpreadsheetBindingInspector.tsx`
- `SpreadsheetFormulaBar.tsx`
- `SpreadsheetImportDialog.tsx`

The existing `ReportsWorkspace` can become the shell that chooses between:

- `CanvasReportWorkspace`
- `SpreadsheetReportWorkspace`

This is cleaner than adding more conditional branches into the already large file.

### Preview Behavior

For spreadsheet mode:

- local preview should not try to parse `xlsx` in the renderer,
- preview should call `resolve-spreadsheet-preview` from the engine,
- returned resolved grid data should be rendered in the center panel.

This avoids adding spreadsheet parsing logic to the desktop renderer and keeps data resolution consistent with export.

### Validation Rules

Add spreadsheet-specific validation:

- source file exists,
- sheet name still exists,
- bound cell address is valid,
- bound tag/tariff references still exist,
- no duplicate binding IDs,
- token expressions parse successfully.

Warnings:

- binding points to empty tag history,
- PDF may not exactly match workbook formulas,
- CSV template has no style metadata.

## Phased Delivery

### Phase 1

- add `spreadsheet` report mode,
- import `xlsx` and `csv`,
- store template file under report assets,
- bind simple values into cells,
- export resolved `.xlsx`,
- preview resolved sheet in editor,
- basic PDF renderer for tabular sheets.

### Phase 2

- named ranges,
- multi-cell fill operations,
- copy/paste bindings,
- token autocomplete,
- formula engine for workbook recalculation,
- better PDF fidelity,
- workbook charts/images if required.

### Phase 3

- scheduled spreadsheet reports,
- version history for imported templates,
- reusable spreadsheet templates in a shared library.

## Acceptance Criteria

The feature is complete when a user can:

1. create a report in spreadsheet mode,
2. import `xlsx` or `csv`,
3. select a cell,
4. bind a tag/billing/report value,
5. preview the resolved workbook in the editor,
6. export the result as `xlsx`,
7. export the same report as `pdf`,
8. run the same export through the existing scheduler later.

## Recommended First Implementation Slice

Build the smallest useful version in this order:

1. `spreadsheet` mode flag in `templateJson`
2. engine import route for `xlsx/csv`
3. editor sheet viewer with cell selection
4. single-cell `tag_metric` binding
5. `.xlsx` export
6. `report_meta` and `billing_metric` bindings
7. basic PDF rendering

This order minimizes risk and proves the core workflow early.
