const assert = require("node:assert/strict");
const test = require("node:test");
const { createPrintDocument } = require("../print-document");

test("builds a standalone document containing only physical print pages", () => {
  const html = createPrintDocument({ title: "工资表", cssHref: "https://example.test/app.css", pagesHtml: '<section class="print-page">工资数据</section>' });
  assert.match(html, /https:\/\/example\.test\/app\.css/);
  assert.match(html, /工资数据/);
  assert.doesNotMatch(html, /生成打印预览/);
  assert.match(html, /window\.print\(\)/);
});
