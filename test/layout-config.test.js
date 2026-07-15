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

test("normalizes defaults and clamps only supported layout values", function () {
  var normalized = layout.normalizeLayout({
    page: { marginMm: 99 },
    title: { fontSizePt: 4, color: "red" },
    groupHeader: { fontSizePt: 99, rowHeightPx: 2 },
    fieldHeader: { rowHeightPx: 99 },
    body: { fontSizePt: 4, rowHeightPx: 2 },
    total: { fontSizePt: 99, rowHeightPx: 99 },
    signature: { fontSizePt: 4, heightMm: 99 },
    border: { color: "#12345", widthPx: 99, style: "dashed" },
    columnWidthsByKey: { GOOD: 30, BAD: "x" },
    extra: true
  });
  assert.equal(normalized.page.paper, "A3 landscape");
  assert.equal(normalized.page.marginMm, 20);
  assert.equal(normalized.title.fontSizePt, 8);
  assert.equal(normalized.title.color, "#000000");
  assert.equal(normalized.groupHeader.fontSizePt, 24);
  assert.equal(normalized.groupHeader.rowHeightPx, 16);
  assert.equal(normalized.fieldHeader.rowHeightPx, 48);
  assert.equal(normalized.body.fontSizePt, 8);
  assert.equal(normalized.body.rowHeightPx, 16);
  assert.equal(normalized.total.fontSizePt, 24);
  assert.equal(normalized.total.rowHeightPx, 48);
  assert.equal(normalized.signature.fontSizePt, 8);
  assert.equal(normalized.signature.heightMm, 20);
  assert.equal(normalized.border.color, "#000000");
  assert.equal(normalized.border.widthPx, 1);
  assert.equal(normalized.border.style, "solid");
  assert.deepEqual(normalized.columnWidthsByKey, { GOOD: 30 });
  assert.equal(normalized.extra, undefined);
});

test("preserves valid colors and constrains widths to leaf minimum and eighty millimeters", function () {
  var normalized = layout.normalizeLayout({ title: { color: "#aBc123" }, columnWidthsByKey: { LOW: 10, HIGH: 99 } });
  var result = layout.applyColumnWidths([
    { key: "LOW", widthMm: 18, minWidthMm: 18 },
    { key: "HIGH", widthMm: 20, minWidthMm: 20 }
  ], normalized);
  assert.equal(normalized.title.color, "#ABC123");
  assert.deepEqual(result.columns.map(function (column) { return [column.key, column.widthMm]; }), [["LOW", 18], ["HIGH", 80]]);
});

test("uses deterministic preview samples capped at thirty rows and including endpoints", function () {
  var rows = Array.from({ length: 100 }, function (_, index) { return { id: index }; });
  var sample = layout.selectPreviewRows(rows, 30);
  assert.equal(sample.length, 30);
  assert.equal(sample[0].id, 0);
  assert.equal(sample.at(-1).id, 99);
  assert.deepEqual(layout.selectPreviewRows(rows, 30), sample);
});

test("serializes CSS variables and scope-aware persistence payloads", function () {
  var source = {
    page: { paper: "A4 landscape", marginMm: 7 },
    title: { fontSizePt: 18, underline: false, fontFamily: "Arial", color: "#010203" },
    columnWidthsByKey: { STFNAM: 24 }
  };
  var css = layout.toLayoutCssVariables(source);
  assert.match(css, /--salary-paper:A4 landscape/);
  assert.match(css, /--salary-page-margin:7mm/);
  assert.match(css, /--salary-title-size:18pt/);
  assert.match(css, /--salary-title-color:#010203/);
  assert.match(css, /--salary-border-color:#000000/);
  assert.match(css, /--salary-body-row-height:20px/);
  assert.equal(layout.toPersistedPayload(source, "global").columnWidthsByKey, undefined);
  assert.deepEqual(layout.toPersistedPayload(source, "salary_group").columnWidthsByKey, { STFNAM: 24 });
  assert.equal(layout.fromPersistedPayload('{"title":{"fontSizePt":19}}').title.fontSizePt, 19);
  assert.equal(layout.fromPersistedPayload("not json").title.fontSizePt, 20);
});

test("rejects unsupported font families before serializing CSS variables", function () {
  var source = { title: { fontFamily: "SimSun;--injected:1" } };
  var normalized = layout.normalizeLayout(source);
  var css = layout.toLayoutCssVariables(source);
  assert.equal(normalized.title.fontFamily, "SimSun");
  assert.doesNotMatch(css, /--injected:/);
});

test("reports prototype-named saved widths as ignored without mutating prototypes", function () {
  var savedWidths = Object.create(null);
  savedWidths.constructor = 20;
  savedWidths.toString = 20;
  savedWidths.__proto__ = 20;
  var result = layout.applyColumnWidths([{ key: "STFNAM", widthMm: 18, minWidthMm: 18 }], { columnWidthsByKey: savedWidths });
  assert.deepEqual(result.ignoredKeys.sort(), ["__proto__", "constructor", "toString"].sort());
  assert.equal({}.polluted, undefined);
});
