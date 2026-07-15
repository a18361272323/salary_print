# Salary Print Style Specification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the salary print output with the approved print specification while keeping page numbers hidden and preserving the current XFT srcdoc delivery route.

**Architecture:** Keep API loading and model-method integration unchanged. Extend the existing column metadata, renderer, layout evaluator, standalone print document, and print CSS; use explicit two-row header markup, metadata-driven value formatting, B4 paper geometry, and CSS pagination guards. Regenerate the immutable asset manifest and onMount payload after verification.

**Tech Stack:** Plain browser JavaScript, CSS, Node.js built-in test runner, XFT generated onMount/srcdoc wrapper, immutable jsDelivr assets.

---

### Task 1: Lock the print contract with failing tests

**Files:**
- Modify: `test/print-renderer.test.js`
- Modify: `test/print-layout.test.js`
- Modify: `test/print-document.test.js`
- Modify: `test/print-styles.test.js`
- Modify: `test/app-logic.test.js`
- Modify: `test/workspace-template.test.js`

- [x] Add assertions for `rowspan="2"` independent headers, grouped two-row headers, centered cell output, amount thousands formatting, integer day formatting, B4 geometry, and B4 selector availability.
- [x] Run the targeted tests and confirm they fail for missing behavior.

### Task 2: Implement column metadata and value formatting

**Files:**
- Modify: `app-logic.js`
- Modify: `print-renderer.js`

- [x] Preserve `itemShowType` and `itemShowFormat` in printable columns and assign business width classes/ranges.
- [x] Render grouped and independent headers with a two-row table head.
- [x] Format decimal values with fixed decimals and thousands separators, integer/day values without decimals, and empty values as empty strings.

### Task 3: Implement paper and pagination protections

**Files:**
- Modify: `print-layout.js`
- Modify: `print-document.js`
- Modify: `app.js`
- Modify: `workspace-template.js`

- [x] Add B4 landscape dimensions and allow it through standalone printing.
- [x] Make A3 landscape the default paper option and retain A4 landscape/portrait choices.
- [x] Return fit ratio metadata while retaining readable-font safeguards.
- [x] Preserve physical rows and protect rows, header groups, totals, and signatures from page splitting.

### Task 4: Apply the approved print visual system

**Files:**
- Modify: `app.css`

- [x] Use Song/Simsun-compatible font family, title underline, explicit centered horizontal/vertical alignment, compact row heights, black one-pixel borders, white table backgrounds, and optional light-gray totals.
- [x] Keep page numbers absent.

### Task 5: Verify and publish

**Files:**
- Modify: `assets.json`
- Modify: `srcdoc-manifest.json`
- Modify: `onmount-salary-print.js` (ignored local artifact)

- [x] Run `npm test`, `npm run check`, and `git diff --check`.
- [ ] Push source, refresh immutable asset URLs, regenerate the helper-generated onMount wrapper while preserving `SalaryPrintModelConfig`, and push the manifest.
- [ ] Re-run payload/reference checks and confirm a clean worktree.
