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
  assert.match(css, /@media print\{[\s\S]*?\.print-page th,\.print-page td\{border-color:#000!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important/);
});
