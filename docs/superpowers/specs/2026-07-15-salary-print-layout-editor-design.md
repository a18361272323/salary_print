# Salary Print Layout Editor Design

## Decision

Add a named secondary window, **版式编辑**, using the existing same-origin salary-print microfrontend route. It is a restricted report-layout editor, not an Excel editor. The selected data snapshot is read-only; no cell, salary amount, field label, group, field order, or visibility control exists in that window.

`column-panel` remains the only authority for field visibility, first-level group order, and second-level field order. The editor is the only authority for print layout: paper, title, header, data/total/signature regions, column widths, font, size, color, alignment, row heights, and borders.

## User flow

1. The user queries a salary group and period, then configures visible fields and order in `column-panel`.
2. Clicking **编辑版式** opens one named window synchronously from the button event. A blocked-popup message offers a retry; no data is placed in the URL.
3. The window receives a read-only snapshot from its same-origin opener and creates a local draft. It previews representative rows only, with a clear `数据锁定` state.
4. The user selects a region (page, title, group header, field header, body, total, signature) and changes only the permitted properties in the inspector. Column-width handles act on visible leaf columns; a group width is always the sum of its children.
5. Undo/redo affects the local style-draft history only. **取消** discards it. **保存并返回** applies the style config in the opener and persists it. **直接打印** prints the local draft without changing the saved template.

## Layout editor contract

| Area | Editable | Not editable |
| --- | --- | --- |
| Page | paper size/orientation, margins, scale policy | data range, salary group, salary period |
| Title | font, size, weight, underline, color, height, alignment | title text business values |
| Group and field headers | font, size, weight, color, row height, background, border, alignment | group membership, labels, order, visibility |
| Data and total rows | font, size, color, row height, padding, border, alignment | cell values, formulas, totals, row order |
| Columns | leaf-column print width; reset width | show/hide, field order, group order, field label |
| Signature area | font, line style, spacing, alignment | signer labels and approval semantics |

The editor contains no `contenteditable`, formula bar, clipboard paste, direct cell-selection editor, or import/export entry. A keyboard user can move between region chips, inspector fields, undo/redo, save, cancel, and print; all controls state their target region.

## Persistence and compatibility

Persist two personal profile layers. A global profile provides stable defaults; a salary-group profile overlays it. Neither profile is keyed by month. Existing column preferences remain unchanged and continue to be keyed by user, salary group, and period.

At load, the effective layout is `system default -> personal global profile -> personal salary-group profile`. `layout_payload` stores style tokens and `columnWidthsByKey`. When the live headers differ, matching field keys keep their widths, unknown saved keys are ignored, and new fields get their calculated default width. The editor shows a non-blocking notice, for example: `检测到 2 个新增字段，已使用默认列宽`.

### Layout-profile model contract

Model identity: `{layoutProfileModelKey}` after current-app metadata readback. Compound business key is `(owner_user_no, scope_type, salary_group_id)`; it is validated by save flow because single-field `unique` cannot express it.

| field code | field label | official field type | required | nullable | default | unique | validation | downstream usage | readback status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| owner_user_no | 配置人 | 短文本 | Yes, isolates personal templates | No | current enterprise user key | no | non-empty; supplied from runtime, never user-editable | model-method list/create/update condition | needs target-model confirmation |
| scope_type | 配置范围 | 枚举 | Yes | No | `global` | no | only `global` or `salary_group` | overlay precedence and save key | needs target-model confirmation |
| salary_group_id | 薪资组标识 | 短文本 | Yes for `salary_group` | Yes for `global` | empty string for `global` | no | required iff `scope_type=salary_group` | group-profile lookup | needs target-model confirmation |
| layout_name | 版式名称 | 短文本 | Yes | No | `默认版式` | no | maximum follows editor confirmation | editor profile title | needs target-model confirmation |
| layout_payload | 版式配置 | JSON | Yes | No | system layout JSON | no | schema-versioned JSON; only permitted style keys and width map | preview and standalone print rendering | needs target-model confirmation |
| layout_version | 配置版本 | 整数 | Yes | No | `1` | no | positive integer; increments on save | migration and optimistic-change check | needs target-model confirmation |
| enabled | 是否启用 | 布尔 | Yes | No | true | no | true for active profile | profile filtering | needs target-model confirmation |
| remark | 备注 | 长文本 | No | Yes | blank | no | no executable content | audit display only | needs target-model confirmation |

Model-method identity must be read back from this model before use: `{layoutProfileListMethodKey}`, `{layoutProfileCreateMethodKey}`, and `{layoutProfileUpdateMethodKey}`. Display labels are not executable method keys. No custom API orchestration is added for this feature.

## Rendering and print contract

The editor and `printOnlyPages` consume the same normalized layout object and the same `colgroup` widths. The DOM renderer has two modes:

- **Editing preview:** title, two-row headers, totals, signature area, and a deterministic sample of at most 30 body rows. It is visually representative but intentionally not a page-count promise.
- **Print composition:** all rows are paginated with the existing print workflow. It uses the saved/draft layout object, repeats the table header per page, keeps rows and final total/signature together where possible, and opens the standalone print document.

The editor retains the approved black one-pixel table borders and locked data values. Every selected style property resolves to a CSS custom property rather than rewriting each cell. The print document receives the resolved tokens in its generated document CSS so screen-preview and printing do not diverge.

## Performance and responsiveness

- Never rebuild all rows while a user drags a width handle or changes a style input. Pointer moves update one CSS custom property on `requestAnimationFrame`; state commits on pointer-up.
- Inspector sliders, color changes, and text-select changes update the preview at most once per animation frame. Persistence occurs only through **保存并返回**, never during dragging.
- Keep the local undo/redo stack as at most 30 small layout-object snapshots; do not snapshot DOM or salary rows.
- Preview sample selection preserves the first row, representative middle rows, and final row. It does not virtualize the actual payroll data because it does not render it.
- Print composition builds pages in document fragments and yields between page batches when the document contains more than 500 rows. Show `正在生成打印稿…` with progress and preserve cancel/back controls before opening the print dialog.
- At an estimated 100,000 print cells or more, warn that browser printing may take time and recommend reducing optional columns or selecting A3. Printing is still user-controlled; the editor itself remains responsive.

Performance acceptance targets on the target browser are: a style change is visible within 100 ms for a 30-row/50-column preview; a column drag does not force full-table reflow per pointer event; and a 100-row/50-column document opens the print preview without a long-task warning. Larger-document behavior is measured and reported rather than assumed.

## Failure states and safeguards

- If the popup is blocked, the main page shows a precise retry instruction; it does not silently lose the current query.
- If the opener is navigated away or its snapshot is unavailable, the editor disables save/print and explains that the user must reopen it from the salary page.
- A failed profile load falls back to system defaults and shows a non-blocking warning; a failed save leaves the draft open and never overwrites the prior saved profile.
- Closing with unsaved changes asks for confirmation. Reset affects only the selected region unless the user explicitly chooses `恢复默认版式`.
- The editor receives no encrypted credentials, cookies, tokens, or salary values in URLs. Same-origin opener access is the communication path; no `postMessage` bridge is required for the selected srcdoc route.

## Data-flow inventory

| item | data source owner | request adapter | response adapter | row identity | permission boundary | refresh proof | target-page confirmation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| field visibility/order | existing column-preference model | existing model-method client | existing preference store | `column_key` | current enterprise user + selected group/period | `column-panel` rerenders after save/load | current `column-panel card no-print reveal` is the sole manager |
| payroll headers | salary header endpoint | existing salary loader | `flattenCategoryHeaders` | `itemKey` | current salary permission | queried header set visible in preview | `printPages` receives the selected header set |
| payroll rows | salary data page endpoint | existing paged loader | `normalizeRows` | source row identity plus rendered sequence | current salary permission | body count and sample rows match query | read-only editor preview is opened from the current salary page |
| global layout profile | `{layoutProfileModelKey}` | same-origin model-method client | `layout_payload` validation and merge | user + `global` | profile owner only | reopening editor restores tokens | target model and method keys require current-app readback |
| group layout profile | `{layoutProfileModelKey}` | same-origin model-method client | `layout_payload` validation and overlay | user + group | profile owner only | switching group applies its overlay | target model and method keys require current-app readback |
| editor draft | in-window memory | none | normalized layout reducer | draft revision | opener snapshot only | cancel leaves parent unchanged; save updates parent once | named same-origin popup opened by the salary-print page |
| print document | current draft or effective profile | standalone print-document builder | resolved CSS tokens + page HTML | print session revision | queried salary data remains read-only | editor and popup output have matching columns/styles | existing standalone print popup is the target output surface |

## Data-chain contract

| item | contract |
| --- | --- |
| data source owner | Payroll headers and rows remain owned by the existing salary endpoints; field visibility/order remains owned by the existing column-preference model; the new layout-profile model owns only personal layout tokens and widths. |
| request adapter | Existing salary loader and existing same-origin model-method client remain the adapters. The editor draft has no network request adapter. |
| response adapter | `flattenCategoryHeaders`, `normalizeRows`, existing preference conversion, and validated `layout_payload` merge normalize all inputs before rendering. |
| row identity | Header identity is `itemKey`; column preference identity is `column_key`; body identity remains the source row identity plus display sequence; draft identity is its revision. |
| permission boundary | Salary endpoints stay under current salary permissions. Layout profiles are scoped to the current enterprise user. The editor gets only the current same-origin opener snapshot and has no URL credentials. |
| refresh proof | Saving a layout reloads the effective profile in the opener and rerenders `printPages`; reopening the editor proves token persistence; cancel leaves the opener unchanged. |
| target-page confirmation | The target is the current salary-print srcdoc page: `column-panel card no-print reveal` controls fields, the named popup controls styles, and the existing standalone print popup emits the document. |

## Validation plan

1. Unit-test normalization, overlay precedence, field-key width reconciliation, invalid payload rejection, undo/redo cap, and read-only editor policy.
2. Test that drag input schedules a single frame update and does not invoke loading, pagination, or persistence.
3. Test representative preview caps body rows at 30 while print composition receives all rows.
4. Test popup draft cancel/save semantics, popup-blocked state, opener-loss state, and standalone print token transfer.
5. Manually test 20 rows/30 columns, 100 rows/50 columns, group-header changes, A4 and A3, print preview, and keyboard navigation in the target XFT page.

## Scope boundary

This phase excludes free-form Excel formulas, direct data editing, importing/exporting a workbook, per-cell styling, cross-user shared templates, and new report-designer dependencies. Those features would create a different authorization, data-integrity, bundle-size, and print-consistency problem.

## Output Preflight

| # | Scan target | Pattern | Pass? | Evidence pointer |
| --- | --- | --- | --- | --- |
| 1 | 模型表 官方字段类型 列 | every value is an allowed official XFT field type | YES | Layout-profile model contract table |
| 2 | 模型表表头 | 10 required columns present | YES | Layout-profile model contract table header |
| 3 | API节点表表头 | no custom API orchestration is added | N/A | Layout-profile model contract paragraph |
| 4 | API节点表 配置列 | no display method name used as executable key | N/A | Model-method identity paragraph |
| 5 | JS 代码块 | no implementation JavaScript is included | YES | full document |
| 6 | 全文 | no shortcut phrase relies on an earlier draft | YES | full document |
| 7 | data-chain 表 | seven required data-chain items present | YES | Data-chain contract |
| 8 | API 编排区段 | not applicable: no custom API orchestration is added | YES | Layout-profile model contract paragraph |

## Contract Validation

- validator: passed
- command: `node C:\Users\Administrator\.codex\skills\di-kai-lowcode\scripts\validate-contract-output.mjs --file docs\superpowers\specs\2026-07-15-salary-print-layout-editor-design.md`
- file: `docs\superpowers\specs\2026-07-15-salary-print-layout-editor-design.md`
- result: `Valid contract output`

## Phase Status

Phase 1 only; not implemented; no platform changes.
