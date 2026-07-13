const assert = require("node:assert/strict");
const test = require("node:test");

const { buildColumns, calculateTotals, normalizeRows } = require("../app-logic");

test("keeps non-printing fields for column configuration and assigns print widths", () => {
  const columns = buildColumns([
    { itemKey: "STFNAM", itemName: "姓名", checkedStatus: "Y", totalHeadFlag: "N" },
    { itemKey: "STFIDN", itemName: "身份证号", checkedStatus: "Y", totalHeadFlag: "N" },
    { itemKey: "NETPAY", itemName: "实发工资", checkedStatus: "N", totalHeadFlag: "Y" }
  ], []);

  assert.deepEqual(columns.map((column) => [column.key, column.printFlag, column.minWidthMm, column.optional]), [
    ["STFNAM", true, 28, false],
    ["STFIDN", true, 34, false],
    ["NETPAY", false, 20, false]
  ]);
});

test("parses salary rows and totals only enabled total columns", () => {
  const columns = [{ key: "STFNAM" }, { key: "NETPAY", totalFlag: true }];
  const rows = normalizeRows([{ uniqueId: "u1", salaryData: '{"STFNAM":"李明","NETPAY":"98.00"}' }], columns);

  assert.deepEqual(rows, [{ _id: "u1", STFNAM: "李明", NETPAY: "98.00" }]);
  assert.deepEqual(calculateTotals(rows, columns), { NETPAY: 98 });
});
