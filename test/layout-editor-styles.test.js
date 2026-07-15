const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readCss() {
  return fs.readFileSync(path.join(__dirname, "..", "app.css"), "utf8");
}

test("applies layout tokens to every salary print section", () => {
  const css = readCss();

  assert.match(css, /\.salary-layout-root\{[^}]*--salary-title-size:20pt/);
  assert.match(css, /\.salary-layout-root\{[^}]*--salary-border-color:#000000/);
  assert.match(css, /\.salary-layout-root\{[^}]*--salary-body-row-height:20px/);
  assert.match(css, /\.salary-layout-root \.print-title h2\{[^}]*font-family:var\(--salary-title-font-family\)[^}]*font-size:var\(--salary-title-size\)[^}]*color:var\(--salary-title-color\)[^}]*text-decoration:var\(--salary-title-underline\)/);
  assert.match(css, /\.salary-layout-root \.group-header th\{[^}]*font-family:var\(--salary-group-header-font-family\)[^}]*height:var\(--salary-group-header-row-height\)/);
  assert.match(css, /\.salary-layout-root \.column-header th\{[^}]*font-family:var\(--salary-field-header-font-family\)[^}]*height:var\(--salary-field-header-row-height\)/);
  assert.match(css, /\.salary-layout-root tbody td\{[^}]*font-family:var\(--salary-body-font-family\)[^}]*height:var\(--salary-body-row-height\)/);
  assert.match(css, /\.salary-layout-root tfoot td\{[^}]*font-family:var\(--salary-total-font-family\)[^}]*height:var\(--salary-total-row-height\)/);
  assert.match(css, /\.salary-layout-root \.signature\{[^}]*min-height:var\(--salary-signature-height\)[^}]*font-family:var\(--salary-signature-font-family\)/);
  assert.match(css, /\.salary-layout-root th,\.salary-layout-root td\{border:var\(--salary-border-width\) var\(--salary-border-style\) var\(--salary-border-color\)/);
});

test("keeps layout editor controls accessible and responsive on screen only", () => {
  const css = readCss();

  assert.match(css, /@media screen\{[\s\S]*?\.layout-editor \.layout-editor-toolbar\{[^}]*position:sticky/);
  assert.match(css, /@media screen\{[\s\S]*?\.layout-editor \.layout-editor-inspector\{[^}]*width:280px/);
  assert.match(css, /@media screen\{[\s\S]*?\.layout-editor \.layout-editor-data-lock\{/);
  assert.match(css, /\.layout-editor :focus-visible\{outline:3px solid/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.layout-editor \*/);
  assert.match(css, /@media screen and \(max-width:960px\)\{[\s\S]*?\.layout-editor \.layout-editor-workspace\{grid-template-columns:1fr/);
});

test("ships the responsive editor treatment inside the popup document", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "layout-editor.js"), "utf8");

  assert.match(source, /class="layout-editor"/);
  assert.match(source, /\.layout-editor-toolbar\{position:sticky;top:0/);
  assert.match(source, /\.layout-editor-inspector\{[^}]*width:280px/);
  assert.match(source, /\.layout-editor-data-lock\{/);
  assert.match(source, /\.layout-editor :focus-visible\{outline:3px solid/);
  assert.match(source, /@media\(prefers-reduced-motion:reduce\)\{\.layout-editor \*/);
  assert.match(source, /@media\(max-width:960px\)\{[\s\S]*?\.layout-editor-workspace\{grid-template-columns:1fr/);
  assert.match(source, /@media print\{[\s\S]*?\.warning\{display:none\}/);
  assert.match(source, /<style>@media screen\{body\{margin:0;background:#f2f0e9/);
  assert.match(source, /\.layout-editor :focus-visible\{outline:3px solid #b79758;outline-offset:2px\}\}@media\(prefers-reduced-motion:reduce\)/);
  assert.match(source, /\.layout-editor\{height:100vh;overflow:hidden;display:grid;grid-template-rows:auto auto minmax\(0,1fr\)\}/);
  assert.match(source, /\.layout-editor-workspace\{[^}]*min-height:0;overflow:hidden/);
  assert.match(source, /\.layout-editor-inspector\{[^}]*height:100%;[^}]*overflow-y:auto/);
});

test("formal print consumes configured tokens with black fallbacks", () => {
  const css = readCss();

  assert.match(css, /\.print-page th,\.print-page td\{border:var\(--salary-border-width,1px\) var\(--salary-border-style,solid\) var\(--salary-border-color,#000\)!important;[^}]*color:var\(--salary-body-color,#000\)!important/);
  assert.match(css, /\.print-page \.group-header th\{[^}]*font-family:var\(--salary-group-header-font-family,"SimSun","宋体",serif\)!important;[^}]*color:var\(--salary-group-header-color,#000\)!important/);
  assert.match(css, /\.print-page \.column-header th\{[^}]*font-family:var\(--salary-field-header-font-family,"SimSun","宋体",serif\)!important;[^}]*color:var\(--salary-field-header-color,#000\)!important/);
  assert.match(css, /\.print-page tbody td\{[^}]*font-family:var\(--salary-body-font-family,"SimSun","宋体",serif\)!important;[^}]*color:var\(--salary-body-color,#000\)!important/);
  assert.match(css, /\.print-page tfoot td\{[^}]*font-family:var\(--salary-total-font-family,"SimSun","宋体",serif\)!important;[^}]*color:var\(--salary-total-color,#000\)!important/);
  assert.match(css, /@media print\{[\s\S]*?\.signature\{[^}]*color:var\(--salary-signature-color,#000\)!important;[^}]*font-family:var\(--salary-signature-font-family,"SimSun","宋体",serif\)!important/);
});
