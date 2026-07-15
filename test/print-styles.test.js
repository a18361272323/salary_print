const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("uses the table top edge as the only title-to-table separator", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "app.css"), "utf8");

  assert.match(css, /\.print-title\{text-align:center;margin-bottom:7mm\}/);
  assert.match(css, /\.continuation-title\{margin:0 0 4mm;font-size:9pt;text-align:center;font-weight:700\}/);
  assert.doesNotMatch(css, /\.print-title\{[^}]*border-bottom/);
  assert.doesNotMatch(css, /\.continuation-title\{[^}]*border-bottom/);
  assert.match(css, /\.signature\{display:grid;grid-template-columns:repeat\(4,1fr\);[^}]*text-align:center/);
  assert.match(css, /@media print\{[\s\S]*?\.standalone-print \.print-page\{box-shadow:none!important/);
  assert.match(css, /@media print\{[\s\S]*?\.print-page th,\.print-page td\{border:var\(--salary-border-width,1px\) var\(--salary-border-style,solid\) var\(--salary-border-color,#000\)!important;text-align:center!important;vertical-align:middle!important/);
  assert.match(css, /\.print-page th,\.print-page td\{[^}]*text-align:center!important;vertical-align:middle!important/);
  assert.match(css, /@media print\{[\s\S]*?\.print-page \.group-header th\{[^}]*height:var\(--salary-group-header-row-height,28px\)[^}]*font-size:var\(--salary-group-header-size,11pt\)/);
  assert.match(css, /@media print\{[\s\S]*?\.print-page \.column-header th\{[^}]*height:var\(--salary-field-header-row-height,28px\)[^}]*font-size:var\(--salary-field-header-size,11pt\)/);
  assert.match(css, /@media print\{[\s\S]*?\.print-page tbody td\{height:var\(--salary-body-row-height,20px\)/);
  assert.match(css, /@media print\{[\s\S]*?\.print-page tfoot td\{height:var\(--salary-total-row-height,20px\)/);
  assert.match(css, /@media print\{[\s\S]*?\.print-title h2\{[^}]*font-size:var\(--salary-title-size,20pt\)/);
  assert.match(css, /\.print-title h2\{[^}]*text-decoration:underline/);
  assert.match(css, /@media print\{[\s\S]*?tbody tr,tfoot,.signature\{break-inside:avoid;page-break-inside:avoid\}/);
  assert.match(css, /\.print-page \.group-header th\{border:var\(--salary-border-width,1px\) var\(--salary-border-style,solid\) var\(--salary-border-color,#000\)!important;[^}]*font-weight:var\(--salary-group-header-weight,700\)/);
  assert.match(css, /\.print-page \.column-header th\{border:var\(--salary-border-width,1px\) var\(--salary-border-style,solid\) var\(--salary-border-color,#000\)!important;[^}]*font-weight:var\(--salary-field-header-weight,700\)/);
});
