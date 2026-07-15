const assert = require("node:assert/strict");
const test = require("node:test");
const { createPrintDocument } = require("../print-document");

test("builds a standalone document containing only physical print pages", () => {
  const html = createPrintDocument({ title: "工资表", cssHref: "https://example.test/app.css", pagesHtml: '<section class="print-page">工资数据</section>', paper: "A3 landscape", fontPt: 8 });
  assert.match(html, /https:\/\/example\.test\/app\.css/);
  assert.match(html, /工资数据/);
  assert.doesNotMatch(html, /生成打印预览/);
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /\.standalone-print \.print-page\{[^}]*box-shadow:none!important/);
  assert.match(html, /border:1px solid #000!important/);
  assert.match(html, /white-space:normal!important/);
  assert.match(html, /\.standalone-print \.right\{text-align:center!important\}/);
  assert.match(html, /@page\{size:A3 landscape;margin:9mm\}/);
  assert.match(html, /--print-font:8pt/);
});

test("keeps B4 landscape as a valid standalone print size", () => {
  const html = createPrintDocument({ title: "工资表", pagesHtml: "<section></section>", paper: "B4 landscape", fontPt: 9 });

  assert.match(html, /@page\{size:B4 landscape;margin:9mm\}/);
});
