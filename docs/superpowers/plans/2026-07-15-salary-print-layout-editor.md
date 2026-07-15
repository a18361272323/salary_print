# Salary Print Layout Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a responsive, read-only-data salary-print layout editor in a named secondary window, with personal global and salary-group profiles, while `column-panel` remains the sole manager of field visibility and order.

**Architecture:** Retain the existing salary loaders, column preference model, pagination, and srcdoc integration. Add pure layout normalization and profile storage modules, render their safe CSS variables through the existing renderer, and pass a local draft between a same-origin popup and its opener only on an explicit save.

**Tech Stack:** Plain UMD browser JavaScript, CSS custom properties, Node built-in test runner, XFT model-method client, same-origin srcdoc/onMount, pinned GitHub/jsDelivr assets.

---

## File structure

| File | Responsibility |
| --- | --- |
| `layout-config.js` | Defaults, safe validation, overlay merge, width reconciliation, sampling, CSS variables. |
| `layout-profile-store.js` | Global/group model-method profile load and save. |
| `layout-editor.js` | Popup shell, draft history, inspector, resize batching. |
| `app.js` | Profile load, opener bridge, effective print columns. |
| `print-renderer.js`, `print-document.js`, `print-workflow.js` | Same token-aware screen and standalone printing. |
| `workspace-template.js`, `app.css` | Edit action and editor presentation. |

### Task 1: Create and read back the layout-profile model

**Files:**
- Platform: current XFT app model metadata
- Modify after readback: ignored `onmount-salary-print.js`
- Modify: `work/salary-print-model-operation-log.md`

- [ ] **Step 1: Create the profile model through the verified metadata chain**

Use `创建 → 字段列表 → validate → draft → 两阶段 revision → 字段/方法回读` to create `salary_print_layout_profile`. Add `owner_user_no` (短文本), `scope_type` (枚举: `global`, `salary_group`), `salary_group_id` (短文本), `layout_name` (短文本), `layout_payload` (JSON), `layout_version` (整数), `enabled` (布尔), and `remark` (长文本). Validate one active business record for `(owner_user_no, scope_type, salary_group_id)`; do not create reserved fields such as `asc`.

- [ ] **Step 2: Read back and prove model-method identity**

Record actual `modelKey`, list, create, and update `methodKey` values. Run list for the current enterprise user, create a disposable global record, update its version, list it again, and disable/remove it. Do not use display names as executable keys.

- [ ] **Step 3: Inject only read-back IDs into the helper-generated host**

Add the following object next to existing `SalaryPrintModelConfig`; replace every angle-bracket value with the returned metadata and retain the verified host wrapper:

```html
<script>
window.SalaryPrintLayoutModelConfig = {
  modelKey: "<read-back modelKey>",
  methods: {
    list: "<read-back list methodKey>",
    create: "<read-back create methodKey>",
    update: "<read-back update methodKey>"
  }
};
</script>
```

- [ ] **Step 4: Record the evidence**

Append model code, actual keys, environment tag, masked test id, and method-run result to `work/salary-print-model-operation-log.md`. Do not commit the ignored generated onMount file.

### Task 2: Build the normalized layout contract with TDD

**Files:**
- Create: `layout-config.js`
- Create: `test/layout-config.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing tests**

```js
var assert = require("node:assert/strict");
var test = require("node:test");
var layout = require("../layout-config");

test("merges a group layout over global settings and drops unknown keys", function () {
  var result = layout.mergeEffectiveLayout(
    { title: { fontSizePt: 20 }, page: { paper: "A4 landscape" }, unknown: "drop" },
    { title: { fontSizePt: 18 }, body: { rowHeightPx: 19 }, injected: "drop" }
  );
  assert.equal(result.title.fontSizePt, 18);
  assert.equal(result.body.rowHeightPx, 19);
  assert.equal(result.unknown, undefined);
  assert.equal(result.injected, undefined);
});

test("reconciles saved widths with current leaf columns", function () {
  var result = layout.applyColumnWidths([
    { key: "STFNAM", widthMm: 18, minWidthMm: 18 },
    { key: "NETPAY", widthMm: 30, minWidthMm: 30 }
  ], { columnWidthsByKey: { STFNAM: 24, OLD_FIELD: 99 } });
  assert.deepEqual(result.columns.map(function (column) { return [column.key, column.widthMm]; }), [["STFNAM", 24], ["NETPAY", 30]]);
  assert.deepEqual(result.addedKeys, ["NETPAY"]);
  assert.deepEqual(result.ignoredKeys, ["OLD_FIELD"]);
});
```

- [ ] **Step 2: Run it before implementation**

Run: `node --test test/layout-config.test.js`

Expected: module-not-found for `layout-config`.

- [ ] **Step 3: Implement the UMD normalization module**

Export `createDefaultLayout`, `normalizeLayout`, `mergeEffectiveLayout`, `applyColumnWidths`, `selectPreviewRows`, `toLayoutCssVariables`, `toPersistedPayload`, and `fromPersistedPayload`. Defaults: A3 landscape/9 mm; SimSun black; title 20 pt underlined; two header rows 11 pt bold/28 px; body/total 9 pt/20 px; black one-pixel solid border; signature 9 pt/6 mm; empty `columnWidthsByKey`.

Clamp fonts to 8–24 pt, row heights to 16–48 px, margins to 0–20 mm, widths to each leaf minimum through 80 mm, and colors to six-digit hex. Global persistence strips width overrides; group persistence keeps them. Sampling returns no more than 30 deterministic rows including first and last.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
node --test test/layout-config.test.js
npm run check
```

Add `node --check layout-config.js` to `package.json`, then commit:

```powershell
git add layout-config.js test/layout-config.test.js package.json
git commit -m "feat: add salary print layout configuration"
```

### Task 3: Add global-plus-group profile persistence

**Files:**
- Create: `layout-profile-store.js`
- Create: `test/layout-profile-store.test.js`
- Modify: `assets.json`, `package.json`

- [ ] **Step 1: Write the failing store test**

```js
var assert = require("node:assert/strict");
var test = require("node:test");
var factory = require("../layout-profile-store");

test("loads global then selected group profile for one owner", async function () {
  var store = factory.createLayoutProfileStore({
    client: { run: async function () { return { list: [
      { id: 1, scope_type: "global", salary_group_id: "", layout_payload: { title: { fontSizePt: 19 } }, enabled: 1 },
      { id: 2, scope_type: "salary_group", salary_group_id: "g1", layout_payload: { body: { rowHeightPx: 18 } }, enabled: 1 }
    ] }; } },
    getOwnerUserNo: async function () { return "user-7"; }
  });
  var loaded = await store.load({ salaryGroupId: "g1" });
  assert.equal(loaded.layout.title.fontSizePt, 19);
  assert.equal(loaded.layout.body.rowHeightPx, 18);
  assert.equal(loaded.records.group.id, 2);
});
```

- [ ] **Step 2: Run before implementation**

Run: `node --test test/layout-profile-store.test.js`

Expected: module-not-found for `layout-profile-store`.

- [ ] **Step 3: Implement strict model record handling**

Implement UMD `createLayoutProfileStore(options)`. `load` calls `client.run("list", { current: 1, pageSize: 20, owner_user_no: owner, enabled: 1 })`, parses JSON text or object payloads, and returns one global + matching group record merged in that order. `save` accepts scope/group/layout/records, rejects any other scope, increments `layout_version`, updates the matching `id` or creates a record, and serializes only normalized payloads.

- [ ] **Step 4: Verify and commit**

Load `./layout-config.js` then `./layout-profile-store.js` before `./app.js` in `assets.json`, add its syntax check, and run:

```powershell
node --test test/layout-profile-store.test.js test/column-preference-store.test.js
npm run check
git add layout-profile-store.js test/layout-profile-store.test.js assets.json package.json
git commit -m "feat: persist salary print layout profiles"
```

### Task 4: Share effective widths and style tokens between preview and print

**Files:**
- Modify: `print-renderer.js`, `print-document.js`, `print-workflow.js`
- Create: `test/layout-rendering.test.js`
- Modify: `test/print-renderer.test.js`, `test/print-document.test.js`

- [ ] **Step 1: Add failing renderer and standalone-document tests**

Test that `{ columnWidthsByKey: { STFNAM: 24 } }` changes the output width without mutating source columns, and test that standalone printing receives `--salary-title-size:20pt`, `--salary-border-color:#000000`, and `--salary-body-row-height:20px`.

```js
test("includes normalized layout variables in standalone printing", function () {
  var html = createPrintDocument({
    title: "工资表",
    pagesHtml: "<section class=\"print-page\"></section>",
    paper: "A3 landscape",
    fontPt: 9,
    layoutCssVariables: "--salary-title-size:20pt;--salary-border-color:#000000;--salary-body-row-height:20px"
  });
  assert.match(html, /--salary-title-size:20pt/);
  assert.match(html, /--salary-border-color:#000000/);
  assert.match(html, /--salary-body-row-height:20px/);
});
```

- [ ] **Step 2: Run focused tests before code changes**

Run: `node --test test/print-renderer.test.js test/print-document.test.js test/layout-rendering.test.js`

Expected: new assertions fail because layout tokens are absent.

- [ ] **Step 3: Implement token-aware rendering**

Pass normalized `layout` into `renderPrintPages`; call `applyColumnWidths` to create effective columns; wrap output in `.salary-layout-root` with only `toLayoutCssVariables(layout)`. Extend `createPrintDocument` with `layoutCssVariables` and normalized page margin. Pass effective columns to `preparePrintDocument` so paper fit sees resized leaf widths. Preserve grouped two-row headers, totals, signatures, black-border fallback, and hidden page numbers.

- [ ] **Step 4: Verify and commit**

```powershell
node --test test/print-renderer.test.js test/print-document.test.js test/print-layout.test.js test/print-workflow.test.js test/layout-rendering.test.js
npm run check
git add print-renderer.js print-document.js print-workflow.js test/print-renderer.test.js test/print-document.test.js test/layout-rendering.test.js
git commit -m "feat: apply layout tokens to salary printing"
```

### Task 5: Implement the restricted popup editor and local draft history

**Files:**
- Create: `layout-editor.js`, `test/layout-editor.test.js`
- Modify: `assets.json`, `package.json`

- [ ] **Step 1: Write failing draft-boundary tests**

```js
var assert = require("node:assert/strict");
var test = require("node:test");
var editor = require("../layout-editor");

test("changes layout without modifying rows or field order", function () {
  var rows = [{ _id: "u1", STFNAM: "李明", NETPAY: "100.00" }];
  var columns = [{ key: "STFNAM" }, { key: "NETPAY" }];
  var controller = editor.createDraftController({ layout: { title: { fontSizePt: 20 } }, rows: rows, columns: columns });
  controller.patch("title.fontSizePt", 18);
  assert.equal(controller.getDraft().title.fontSizePt, 18);
  assert.deepEqual(rows, [{ _id: "u1", STFNAM: "李明", NETPAY: "100.00" }]);
  assert.deepEqual(columns.map(function (column) { return column.key; }), ["STFNAM", "NETPAY"]);
});

test("caps history at thirty snapshots and supports undo redo", function () {
  var controller = editor.createDraftController({ layout: {} });
  for (var index = 0; index < 40; index += 1) controller.patch("body.rowHeightPx", 16 + index);
  assert.ok(controller.getHistoryLength() <= 30);
  assert.equal(controller.undo(), true);
  assert.equal(controller.redo(), true);
});
```

- [ ] **Step 2: Run before implementation**

Run: `node --test test/layout-editor.test.js`

Expected: module-not-found for `layout-editor`.

- [ ] **Step 3: Implement safe draft operations**

Export `createDraftController` and `openLayoutEditor`. The controller exposes only `patch`, `replaceWidth`, `undo`, `redo`, `discard`, `isDirty`, `getDraft`, and `getHistoryLength`; it clones normalized layout data and provides no mutator for rows, values, group labels, visibility, or order.

- [ ] **Step 4: Implement popup UI and lifecycle**

Open `window.open("", "salary-print-layout-editor", "popup=yes,width=1440,height=920")` synchronously from the parent click. A null result invokes `onBlocked()` only. Render toolbar actions (undo, redo, reset, cancel, save-return, direct print), scope selector, `数据锁定` banner, central preview, and inspector for page/title/group header/field header/body/total/signature/border. Set `aria-readonly="true"`; include no `contenteditable`, formula bar, data input, field toggle, or reorder control.

Use `selectPreviewRows(rows, 30)`. Width pointer moves use pointer capture and at most one `requestAnimationFrame` CSS update; write history only on pointer-up. Before save or print, verify the opener snapshot; if unavailable disable those actions and display `源工资表已失效，请返回后重新打开版式编辑器。`. Warn only on dirty close. Direct print calls `onPrint(draft)` and never storage save.

- [ ] **Step 5: Verify and commit**

```powershell
node --test test/layout-editor.test.js test/layout-config.test.js
npm run check
git add layout-editor.js test/layout-editor.test.js assets.json package.json
git commit -m "feat: add read-only salary layout editor"
```

### Task 6: Integrate layout state without weakening `column-panel` authority

**Files:**
- Modify: `workspace-template.js`, `app.js`, `test/workspace-template.test.js`
- Create: `test/layout-integration.test.js`

- [ ] **Step 1: Add failing workbench tests**

Require `id="editLayout"` and `id="layoutProfileStatus"`; confirm `columnEditor` remains inside `.column-panel`. Add a pure integration test that effective columns receive layout widths but retain `printFlag`, `order`, `group`, and `secondGroup` from existing column preferences.

- [ ] **Step 2: Run before implementation**

Run: `node --test test/workspace-template.test.js test/layout-integration.test.js`

Expected: edit action/status and effective-column adapter are absent.

- [ ] **Step 3: Add controls and state**

Add disabled `编辑版式` next to `打印预览` and `layoutProfileStatus` with `字段顺序与显示请在左侧“打印列”调整。`. Add `layoutStore`, `layoutRecords`, `layout`, and `layoutLoadWarning` to `app.js`. Initialize the store from `SalaryPrintLayoutModelConfig`, existing runtime context, and model-method client. If configuration is absent, use defaults and show `版式保存模型尚未注入，当前修改仅本次有效。`.

- [ ] **Step 4: Load, save, and print through one layout path**

Query headers, column preferences, and layout profile concurrently. Keep `state.columns` exactly as built today; apply width clones only when preparing/rendering. Main `paperSelect` is a transient session choice and persists only after popup save. Default popup scope to `salary_group`; global save omits widths. A save reloads the current effective profile, reruns `prepare`, and reports global or group save success. Cancel has no parent mutation. Both popup and main print call one helper that calculates effective columns, fit, and `layoutCssVariables` before `createPrintDocument`.

- [ ] **Step 5: Verify and commit**

```powershell
node --test test/workspace-template.test.js test/layout-integration.test.js test/layout-profile-store.test.js test/print-workflow.test.js
npm run check
git add app.js workspace-template.js test/workspace-template.test.js test/layout-integration.test.js
git commit -m "feat: connect salary layout editor to print workbench"
```

### Task 7: Apply responsive editor styles while retaining formal print styles

**Files:**
- Modify: `app.css`, `test/print-styles.test.js`
- Create: `test/layout-editor-styles.test.js`

- [ ] **Step 1: Add failing style assertions**

Assert that `.salary-layout-root` defines `--salary-title-size`, `--salary-border-color`, and `--salary-body-row-height`; assert that `.layout-editor` has sticky toolbar, inspector, lock banner, focus-visible, and reduced-motion coverage. Retain current assertions for black borders and centered cells.

- [ ] **Step 2: Run before implementation**

Run: `node --test test/print-styles.test.js test/layout-editor-styles.test.js`

Expected: new selectors and variables are absent.

- [ ] **Step 3: Implement variable-based styles**

Apply safe variables to title, both header rows, body, total, signature, and borders. Preserve `table-layout:fixed`, print `overflow-wrap:anywhere`, centered horizontal/vertical alignment, black borders, repeated headers, and pagination guards. Style the popup as sticky toolbar + preview canvas + 280 px inspector, collapsing below 960 px; use 8 px resize handles and keyboard width inputs. Keep editor decoration under `@media screen` so it cannot leak into printing.

- [ ] **Step 4: Verify and commit**

Run the new style tests and `npm run check`; commit `app.css`, `test/print-styles.test.js`, and `test/layout-editor-styles.test.js` with `feat: style responsive salary layout editor`.

### Task 8: Publish immutable assets and prove the live XFT behavior

**Files:**
- Modify: `assets.json`, `srcdoc-manifest.json`, `test/asset-manifest.test.js`
- Modify: `work/salary-print-model-operation-log.md`

- [ ] **Step 1: Extend asset-manifest tests**

Require `assets.json` to contain `./layout-config.js`, `./layout-profile-store.js`, and `./layout-editor.js` before `./app.js`; retain relative path and pinned fallback URL tests.

- [ ] **Step 2: Run full local verification**

Run `npm test`, `npm run check`, `git diff --check`, and `git status --short`. Expected: all tests/syntax checks pass, whitespace is clean, and only intended files are pending.

- [ ] **Step 3: Commit, push, and pin the manifest**

Commit intended source/test files, push, read the immutable commit SHA, and replace both URLs in `srcdoc-manifest.json` with that SHA. Test the manifest, commit/push its pin, then regenerate the ignored onMount host using the verified helper wrapper plus real layout-model metadata.

- [ ] **Step 4: Validate target-page behavior**

Verify: (1) only `column-panel` changes fields/order; (2) popup locks salary values and labels; (3) width/style changes are responsive; (4) group profile works in another period; (5) global profile works in another group without widths; (6) a new header uses default width and warns; (7) A4/B4/A3 have repeated headers, black borders, no page number, final-only total/signature, and matching styles; (8) blocked popup, opener loss, cancellation, and failed save leave the prior profile intact.

- [ ] **Step 5: Record final proof**

Append method-run results, final manifest SHA, and manual print checks to `work/salary-print-model-operation-log.md`; commit tracked documentation and manifest updates only.

## Plan self-review

- **Spec coverage:** Tasks 1/3 persist profiles; Tasks 2/6 preserve field ownership; Tasks 4/6/7 share screen and print styles; Task 5 prevents data edits; Task 8 proves performance, failures, and live behavior.
- **Type consistency:** `layout-config` owns normalized objects; `layout-profile-store` persists them; `layout-editor` drafts them; app, renderer, workflow, and standalone print use the same effective layout and CSS variables.
- **Scope:** No spreadsheet engine, formulas, cell edits, workbook import/export, shared templates, or per-cell styling is introduced.
