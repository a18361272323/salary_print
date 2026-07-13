const assert = require("node:assert/strict");
const test = require("node:test");

const { preparePrintDocument } = require("../print-workflow");

test("blocks printing and suggests A3 when A4 cannot fit visible columns", async () => {
  const result = await preparePrintDocument({
    paper: "A4 landscape",
    columns: [{ printFlag: true, minWidthMm: 130 }, { printFlag: true, minWidthMm: 130 }, { printFlag: true, minWidthMm: 130 }],
    loader: { loadPage: async () => ({ records: [{ id: 1 }], total: 1 }) }
  });

  assert.equal(result.canPrint, false);
  assert.equal(result.fit.status, "suggest-a3");
  assert.equal(result.loaded.complete, true);
});

test("prepares continuous pages only after complete loading", async () => {
  const result = await preparePrintDocument({
    paper: "A4 landscape",
    columns: [{ printFlag: true, minWidthMm: 18 }],
    loader: {
      loadPage: async ({ current }) => current === 1
        ? { records: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })), total: 101 }
        : { records: [{ id: 101 }], total: 101 }
    }
  });

  assert.equal(result.canPrint, true);
  assert.equal(result.loaded.records.length, 101);
  assert.equal(result.pages.at(-1).includeSummary, true);
  assert.deepEqual(result.pages.flatMap((page) => page.rows.map((row) => row.id)), Array.from({ length: 101 }, (_, index) => index + 1));
});
