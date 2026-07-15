const assert = require("node:assert/strict");
const test = require("node:test");

const { renderPrintPages } = require("../print-renderer");
const { createPrintDocument } = require("../print-document");
const { preparePrintDocument } = require("../print-workflow");
const { derivePageCapacity } = require("../print-layout");

test("renders saved column widths without mutating source columns", () => {
  const columns = [
    { key: "STFNAM", label: "姓名", widthMm: 18, minWidthMm: 18 },
    { key: "NETPAY", label: "实发工资", widthMm: 18, minWidthMm: 18, totalFlag: true }
  ];

  const html = renderPrintPages({
    pages: [{ kind: "first-last", rows: [{ STFNAM: "甲", NETPAY: 10 }], includeSummary: true }],
    columns,
    totals: { NETPAY: 10 },
    layout: { columnWidthsByKey: { STFNAM: 36 } }
  });

  assert.match(html, /<div class="salary-layout-root" style="[^"]*--salary-title-size:20pt[^"]*">/);
  assert.match(html, /<colgroup><col style="width:66\.67%"><col style="width:33\.33%"><\/colgroup>/);
  assert.equal(columns[0].widthMm, 18);
  assert.equal(columns[1].widthMm, 18);
});

test("keeps grouped headers, totals, and signatures when rendering a layout", () => {
  const html = renderPrintPages({
    pages: [{ kind: "first-last", rows: [{ STFNAM: "甲", BASEPAY: 10, NETPAY: 8 }], includeSummary: true }],
    columns: [
      { key: "STFNAM", label: "姓名", widthMm: 18, minWidthMm: 18 },
      { key: "BASEPAY", label: "基本工资", group: "应发工资", widthMm: 18, minWidthMm: 18, totalFlag: true },
      { key: "NETPAY", label: "实发工资", group: "实发工资", widthMm: 18, minWidthMm: 18, totalFlag: true }
    ],
    totals: { BASEPAY: 10, NETPAY: 8 },
    layout: { columnWidthsByKey: { STFNAM: 30 } }
  });

  assert.match(html, /<tr class="group-header"><th rowspan="2">姓名<\/th><th colspan="1">应发工资<\/th><th colspan="1">实发工资<\/th><\/tr>/);
  assert.match(html, /<tr class="column-header"><th>基本工资<\/th><th>实发工资<\/th><\/tr>/);
  assert.match(html, /<tfoot><tr><td class="">合计<\/td><td class="right">10\.00<\/td><td class="right">8\.00<\/td><\/tr><\/tfoot>/);
  assert.match(html, /<\/table><footer class="signature">/);
});

test("adds normalized layout variables and margin to standalone documents", () => {
  const html = createPrintDocument({
    title: "工资表",
    paper: "A4 landscape",
    pagesHtml: "<section></section>",
    layout: {
      page: { marginMm: 7 },
      title: { fontSizePt: 18 },
      border: { color: "#123456" },
      body: { rowHeightPx: 26 }
    }
  });

  assert.match(html, /@page\{size:A4 landscape;margin:7mm\}/);
  assert.match(html, /--salary-title-size:18pt/);
  assert.match(html, /--salary-border-color:#123456/);
  assert.match(html, /--salary-body-row-height:26px/);
});

test("accepts workflow layout variables with a normalized page margin", () => {
  const html = createPrintDocument({
    paper: "B4 landscape",
    pagesHtml: "<section></section>",
    pageMarginMm: 6,
    layoutCssVariables: "--salary-title-size:17pt;--salary-border-color:#010203"
  });

  assert.match(html, /@page\{size:B4 landscape;margin:6mm\}/);
  assert.match(html, /--salary-title-size:17pt/);
  assert.match(html, /--salary-border-color:#010203/);
});

test("clamps malformed standalone margins and drops unsafe CSS declarations", () => {
  const clamped = createPrintDocument({
    paper: "A4 landscape",
    pagesHtml: "<section></section>",
    pageMarginMm: 99,
    layoutCssVariables: "--salary-title-size:18pt;--injected:1;--salary-body-row-height:20px}"
  });
  const defaulted = createPrintDocument({ pagesHtml: "<section></section>", pageMarginMm: "not-a-number" });

  assert.match(clamped, /@page\{size:A4 landscape;margin:20mm\}/);
  assert.match(clamped, /--salary-title-size:18pt/);
  assert.doesNotMatch(clamped, /--injected:1/);
  assert.doesNotMatch(clamped, /--salary-body-row-height:20px\}/);
  assert.match(defaulted, /@page\{size:A4 landscape;margin:9mm\}/);
});

test("uses effective saved widths when evaluating paper fit", async () => {
  const columns = [{ key: "STFNAM", printFlag: true, widthMm: 18, minWidthMm: 18 }];
  const result = await preparePrintDocument({
    paper: "A4 landscape",
    columns,
    layout: { columnWidthsByKey: { STFNAM: 80 } },
    loader: { loadPage: async () => ({ records: [{ STFNAM: "甲" }], total: 1 }) }
  });

  assert.equal(result.fit.requiredWidthMm, 80);
  assert.equal(result.columns[0].widthMm, 80);
  assert.equal(columns[0].widthMm, 18);
  assert.match(result.layoutCssVariables, /--salary-page-margin:9mm/);
});

test("hands effective columns and layout tokens from workflow to standalone print", async () => {
  const result = await preparePrintDocument({
    paper: "A4 landscape",
    columns: [
      { key: "STFNAM", label: "姓名", printFlag: true, widthMm: 18, minWidthMm: 18 },
      { key: "NETPAY", label: "实发工资", printFlag: true, widthMm: 18, minWidthMm: 18, totalFlag: true }
    ],
    layout: { page: { marginMm: 6 }, title: { fontSizePt: 17 }, columnWidthsByKey: { STFNAM: 36 } },
    loader: { loadPage: async () => ({ records: [{ STFNAM: "甲", NETPAY: 10 }], total: 1 }) }
  });
  const pagesHtml = renderPrintPages({ pages: result.pages, columns: result.columns, totals: { NETPAY: 10 }, layout: result.layout });
  const documentHtml = createPrintDocument({
    paper: result.fit.paper,
    pagesHtml,
    layoutCssVariables: result.layoutCssVariables,
    pageMarginMm: result.pageMarginMm
  });

  assert.equal(result.pageMarginMm, 6);
  assert.equal(result.columns[0].widthMm, 36);
  assert.match(result.layoutCssVariables, /--salary-title-size:17pt/);
  assert.match(documentHtml, /@page\{size:A4 landscape;margin:6mm\}/);
  assert.match(documentHtml, /--salary-title-size:17pt/);
  assert.match(documentHtml, /<colgroup><col style="width:66\.67%"><col style="width:33\.33%"><\/colgroup>/);
});

test("accounts for a twenty-millimeter layout margin when fitting effective columns", async () => {
  const result = await preparePrintDocument({
    paper: "A4 landscape",
    columns: [
      { key: "STFNAM", printFlag: true, widthMm: 18, minWidthMm: 18 },
      { key: "BASEPAY", printFlag: true, widthMm: 18, minWidthMm: 18 },
      { key: "BONUS", printFlag: true, widthMm: 18, minWidthMm: 18 },
      { key: "NETPAY", printFlag: true, widthMm: 18, minWidthMm: 18 }
    ],
    layout: { page: { marginMm: 20 }, columnWidthsByKey: { STFNAM: 80, BASEPAY: 80, BONUS: 80, NETPAY: 30 } },
    loader: { loadPage: async () => ({ records: [{ STFNAM: "甲", NETPAY: 10 }], total: 1 }) }
  });

  assert.equal(result.fit.requiredWidthMm, 270);
  assert.notEqual(result.fit.fontPt, 9);
});

test("reduces page capacity when a layout has wider margins", () => {
  const defaultMargin = derivePageCapacity("A4 landscape", 9, { marginMm: 9 });
  const wideMargin = derivePageCapacity("A4 landscape", 9, { marginMm: 20 });

  assert.ok(wideMargin.firstPageRows < defaultMargin.firstPageRows);
  assert.ok(wideMargin.middlePageRows < defaultMargin.middlePageRows);
  assert.ok(wideMargin.lastPageRows < defaultMargin.lastPageRows);
});

test("keeps the existing capacity when callers use the historical nine-millimeter margin", () => {
  assert.deepEqual(
    derivePageCapacity("A4 landscape", 9),
    derivePageCapacity("A4 landscape", 9, { marginMm: 9 })
  );
});
