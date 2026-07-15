const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("loads a pinned SortableJS ESM runtime for the srcdoc workbench", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "sortable-runtime.js"), "utf8");

  assert.match(source, /sortablejs@1\.15\.7\/modular\/sortable\.esm\.js/);
  assert.match(source, /SalaryPrintSortable/);
});
