# Salary Print Operation Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use one server-side API orchestration to save a full column snapshot and make all waiting operations visible and mutually exclusive.

**Architecture:** A browser-side operation coordinator controls one active operation, its status, locks, and write-time leave protection. A custom XFT API orchestration validates and writes the complete column snapshot inside a confirmed transaction, then returns the saved records to the browser.

**Tech Stack:** Browser JavaScript, Node built-in test runner, XFT API orchestration, same-origin srcdoc microfrontend.

---

### Task 1: Read back the target API and write a safe baseline

**Files:**
- Create: `docs/superpowers/operation-log/2026-07-16-column-save-api-readback.md`
- Test: target API debug, target model readback, browser Network capture

- [ ] **Step 1: Capture the current save request count**

Save an unchanged column snapshot with browser Network capture. Record sanitized request count, response envelope, list/create/update method identities, and model-record count. Exclude cookies, tokens, user data, and raw salary rows.

- [ ] **Step 2: Confirm target capabilities**

Read API-editor availability for mapper, script, model-method, transaction, and output-mapping nodes. Read the column model list/create/update method keys and confirm the fields `column_key`, `print_flag`, `display_order`, `top_group`, `second_group`, `total_flag`, `salary_group_id`, `salary_cycle`, `profile_type`, and `enabled`.

- [ ] **Step 3: Commit the operation log**

Run `git add docs/superpowers/operation-log/2026-07-16-column-save-api-readback.md` then `git commit -m "docs: record column save API readback"`.

### Task 2: Create and prove the one-call save API

**Files:**
- Create: `docs/superpowers/api-specs/save-salary-print-columns.api-flow.json`
- Create: `test/column-config-api-client.test.js`
- Modify: target XFT API orchestration

- [ ] **Step 1: Write the failing public-client test**

```javascript
test("sends one complete column snapshot to the custom save API", async function () {
  var calls = [];
  var client = createColumnConfigApiClient({ run: async function (input) { calls.push(input); return { records: [{ id: 1, column_key: "NETPAY" }], savedCount: 1 }; } });
  var result = await client.save({ salaryGroupId: "g1", salaryCycle: "202606", columns: [{ key: "NETPAY", printFlag: true, order: 100, group: "统计", secondGroup: "实发工资", totalFlag: true }] });
  assert.equal(calls.length, 1);
  assert.equal(result.savedCount, 1);
  assert.equal(result.records[0].column_key, "NETPAY");
});
```

- [ ] **Step 2: Run RED**

Run `node --test test/column-config-api-client.test.js`. Expected: FAIL because `column-config-api-client.js` is absent.

- [ ] **Step 3: Create the flow from readback facts**

The public input is `salaryGroupId`, `salaryCycle`, and `columns[]`, where each row has `columnKey`, `printFlag`, `displayOrder`, `topGroup`, `secondGroup`, and `totalFlag`. The output is `savedCount`, `records`, and `version`. The flow order is: normalize `state.xcInput`; validate non-empty group/cycle, unique keys, integer orders and 0/1 flags; resolve owner from confirmed server context; query existing `profile_type=column` records; transaction-scoped create/update; collect records; map all output fields to `state.xcOutput`.

- [ ] **Step 4: Debug side effects and rollback**

Send a safe current snapshot through API debug. Verify non-empty final body, model readback, one browser request, and an intentionally duplicate key request that produces no record change. Transaction rollback semantics remain unclaimed until this target proof exists.

- [ ] **Step 5: Validate and commit**

Run `node C:\Users\Administrator\.codex\skills\di-kai-lowcode\scripts\validate-specs.mjs --type api-flow-spec --file docs/superpowers/api-specs/save-salary-print-columns.api-flow.json`, then commit the API specification and failing-to-passing client test with `git commit -m "feat: add batch column save API contract"`.

### Task 3: Implement the coordinator and custom API client

**Files:**
- Create: `operation-coordinator.js`
- Create: `column-config-api-client.js`
- Create: `test/operation-coordinator.test.js`
- Modify: `assets.json`
- Modify: `package.json`

- [ ] **Step 1: Write the failing coordinator test**

```javascript
test("locks a second operation until the active operation settles", async function () {
  var release;
  var coordinator = createOperationCoordinator({ onChange: function () {} });
  var first = coordinator.run("savingColumns", function () { return new Promise(function (resolve) { release = resolve; }); });
  assert.equal(coordinator.isBusy(), true);
  await assert.rejects(coordinator.run("querying", function () {}), /正在保存列配置/);
  release({ savedCount: 2 });
  await first;
  assert.equal(coordinator.isBusy(), false);
});
```

- [ ] **Step 2: Run RED**

Run `node --test test/operation-coordinator.test.js test/column-config-api-client.test.js`. Expected: FAIL because the modules are absent.

- [ ] **Step 3: Implement both browser modules**

`createOperationCoordinator({ onChange })` exposes `run(kind, operation)`, `isBusy()`, `current()`, and `beforeUnloadMessage()`. It holds one `{ kind, label, startedAt, progress }` object, rejects a second operation, calls `onChange` on every state change, and clears active state in `finally`.

`createColumnConfigApiClient({ run })` converts browser columns to the verified public API input, invokes `run` once, rejects missing `savedCount` or `records`, and returns `{ savedCount, records, version }`. It never invokes model-method list/create/update.

- [ ] **Step 4: Register and verify**

Load the modules before `app.js` in `assets.json`; add both to `npm run check`; run `node --test test/operation-coordinator.test.js test/column-config-api-client.test.js` and `npm run check`; commit with `git commit -m "feat: coordinate print operations and batch column saves"`.

### Task 4: Integrate all locks, feedback, and one-call save

**Files:**
- Modify: `workspace-template.js`
- Modify: `app.css`
- Modify: `app.js`
- Modify: `layout-editor.js`
- Modify: `test/workspace-template.test.js`
- Modify: `test/app-session.test.js`
- Modify: `test/layout-editor.test.js`

- [ ] **Step 1: Write failing integration tests**

Assert that the workspace contains an `aria-live="polite"` operation status, a column save invokes the custom API exactly once without an immediate preference-store list, and an active parent save prevents editor actions until it settles.

- [ ] **Step 2: Run RED**

Run `node --test test/workspace-template.test.js test/app-session.test.js test/layout-editor.test.js`. Expected: FAIL because no global operation integration exists.

- [ ] **Step 3: Add feedback and lock policy**

Add an accessible operation-status element plus a compact spinner. On active operation lock query, group/month, paper, column toggle/drag/reset, both saves, editor open, and printing; preserve scrolling. Show loaded-row progress for query and indeterminate status for saves/printing.

- [ ] **Step 4: Route all waiting operations through the coordinator**

Wrap initialization, query, one-call column save, layout save/reload/prepare, and print preparation. Add `beforeunload` only for `savingColumns` and `savingLayout`; remove it when each operation settles.

- [ ] **Step 5: Replace the old column loop**

Capture group, cycle, and query token. Call the custom API once. On a current snapshot, replace `state.preferenceRecords` with returned records and show saved count. On error or stale response, preserve confirmed records and unlock controls. Remove the old `state.preferenceStore.save` and immediate `load` path from column save.

- [ ] **Step 6: Verify and commit**

Run `node --test test/workspace-template.test.js test/app-session.test.js test/layout-editor.test.js test/operation-coordinator.test.js test/column-config-api-client.test.js`, then commit with `git commit -m "feat: show and lock active print operations"`.

### Task 5: Deliver and prove runtime behavior

**Files:**
- Modify: `srcdoc-manifest.json`
- Modify: `test/asset-manifest.test.js`
- Modify: ignored `onmount-salary-print.js`

- [ ] **Step 1: Run full local validation**

Run `npm test`, `npm run check`, and `git diff --check`. Expected: all tests pass and no syntax or whitespace errors.

- [ ] **Step 2: Publish immutable assets**

Push the implementation, pin `srcdoc-manifest.json` and its test to the pushed full SHA, push the pin commit, and verify jsDelivr and raw GitHub `assets.json` return HTTP 200.

- [ ] **Step 3: Generate onMount**

Use `C:\Users\Administrator\.codex\skills\di-kai-lowcode\scripts\build-srcdoc-onmount-host.mjs`; preserve its event wrapper and replace only base64 payload after injecting existing fallback manifest and read-back model configuration. Run `node --check onmount-salary-print.js` and decode it to verify immutable URLs and model configuration.

- [ ] **Step 4: Verify target runtime**

With explicit online-write authorization, replace the page onMount and verify one browser save request, visible loading text, disabled conflicting controls, successful returned records, invalid-request no-write proof, and restored controls after success and failure.
