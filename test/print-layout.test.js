const assert = require("node:assert/strict");
const test = require("node:test");

const { derivePageCapacity, evaluatePaperFit, paginatePrintRows } = require("../print-layout");

test("suggests A3 landscape instead of reducing an A4 print below 6.5pt", () => {
  const result = evaluatePaperFit({ paper: "A4 landscape", columns: [{ minWidthMm: 130 }, { minWidthMm: 130 }, { minWidthMm: 130 }] });

  assert.deepEqual(result, { status: "suggest-a3", paper: "A4 landscape", fontPt: 6.5, scale: 0.7153846153846154, widthRatio: 0.7153846153846154, suggestedPaper: "A3 landscape", requiredWidthMm: 390 });
});

test("uses a readable reduced font when A4 can fit within the lower limit", () => {
  const result = evaluatePaperFit({ paper: "A4 landscape", columns: [{ minWidthMm: 100 }, { minWidthMm: 100 }, { minWidthMm: 100 }] });

  assert.deepEqual(result, { status: "fit", paper: "A4 landscape", fontPt: 8, scale: 1, widthRatio: 0.93, requiredWidthMm: 300 });
});

test("reserves the final page for totals and signatures", () => {
  const pages = paginatePrintRows({ rows: Array.from({ length: 55 }, (_, index) => ({ id: index + 1 })), layout: { firstPageRows: 18, middlePageRows: 24, lastPageRows: 12 } });

  assert.deepEqual(pages.map((page) => [page.kind, page.rows.length]), [["first", 18], ["middle", 24], ["middle", 1], ["last", 12]]);
  assert.equal(pages.at(-1).includeSummary, true);
  assert.deepEqual(pages.flatMap((page) => page.rows.map((row) => row.id)), Array.from({ length: 55 }, (_, index) => index + 1));
});

test("creates a single final page for short documents and marks it as the first page", () => {
  const pages = paginatePrintRows({ rows: [{ id: 1 }], layout: { firstPageRows: 18, middlePageRows: 24, lastPageRows: 12 } });

  assert.deepEqual(pages.map((page) => [page.kind, page.rows.length, page.includeSummary]), [["first-last", 1, true]]);
});

test("derives smaller printable capacities for A4 than A3", () => {
  const a4 = derivePageCapacity("A4 landscape", 9);
  const a3 = derivePageCapacity("A3 landscape", 9);

  assert.ok(a4.firstPageRows < a3.firstPageRows);
  assert.ok(a4.lastPageRows < a3.lastPageRows);
  assert.ok(a4.lastPageRows < a4.middlePageRows);
});

test("reserves one row of vertical space for the grouped first-level header", () => {
  const a4 = derivePageCapacity("A4 landscape", 9);

  assert.deepEqual(a4, { firstPageRows: 13, middlePageRows: 16, lastPageRows: 11 });
});

test("supports B4 landscape and reports the print-width ratio", () => {
  const fit = evaluatePaperFit({ paper: "B4 landscape", columns: [{ minWidthMm: 173 }, { minWidthMm: 173 }] });
  const b4 = derivePageCapacity("B4 landscape", 9);

  assert.equal(fit.status, "fit");
  assert.equal(fit.scale, 1);
  assert.ok(fit.widthRatio >= 1);
  assert.ok(b4.firstPageRows > 0);
});
