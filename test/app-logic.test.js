const assert = require("node:assert/strict");
const test = require("node:test");

const { buildColumns, calculateTotals, normalizeRows, groupColumnsByTopGroup, orderColumnsByKeys, moveGroup, moveColumnWithinGroup, fromPreferenceRecords, toPreferenceRecords, flattenCategoryHeaders } = require("../app-logic");

test("keeps non-printing fields for column configuration and assigns print widths", () => {
  const columns = buildColumns([
    { itemKey: "STFNAM", itemName: "姓名", checkedStatus: "Y", totalHeadFlag: "N" },
    { itemKey: "STFIDN", itemName: "身份证号", checkedStatus: "Y", totalHeadFlag: "N" },
    { itemKey: "NETPAY", itemName: "实发工资", checkedStatus: "N", totalHeadFlag: "Y" }
  ], []);

  assert.deepEqual(columns.map((column) => [column.key, column.printFlag, column.minWidthMm, column.optional]), [
    ["STFNAM", true, 18, false],
    ["STFIDN", true, 34, false],
    ["NETPAY", false, 30, false]
  ]);
});

test("parses salary rows and totals only enabled total columns", () => {
  const columns = [{ key: "STFNAM" }, { key: "NETPAY", totalFlag: true }];
  const rows = normalizeRows([{ uniqueId: "u1", salaryData: '{"STFNAM":"李明","NETPAY":"98.00"}' }], columns);

  assert.deepEqual(rows, [{ _id: "u1", STFNAM: "李明", NETPAY: "98.00" }]);
  assert.deepEqual(calculateTotals(rows, columns), { NETPAY: 98 });
});

test("allocates wider printable columns to department and position values", () => {
  const columns = buildColumns([
    { itemKey: "ORGSEQ", itemName: "部门", checkedStatus: "Y", totalHeadFlag: "N" },
    { itemKey: "POSSEQ", itemName: "岗位", checkedStatus: "Y", totalHeadFlag: "N" }
  ], []);

  assert.deepEqual(columns.map((column) => [column.key, column.minWidthMm]), [["ORGSEQ", 34], ["POSSEQ", 28]]);
});

test("keeps interface display metadata for type-aware print formatting", () => {
  const columns = buildColumns([
    { itemKey: "BASEPAY", itemName: "基本工资", itemShowType: "DEC", itemShowFormat: "2", checkedStatus: "Y", totalHeadFlag: "N" },
    { itemKey: "ATTEND", itemName: "出勤天数", itemShowType: "INT", checkedStatus: "Y", totalHeadFlag: "N" }
  ], []);

  assert.deepEqual(columns.map((column) => [column.itemShowType, column.itemShowFormat]), [["DEC", "2"], ["INT", undefined]]);
  assert.ok(columns[0].minWidthMm >= 20);
  assert.ok(columns[1].minWidthMm <= 14);
});

test("keeps first and second header metadata and groups column settings by first header", () => {
  const preferences = fromPreferenceRecords([{ column_key: "BASEPAY", print_flag: 1, display_order: 200, top_group: "应发工资", second_group: "固定收入", total_flag: 0 }]);
  const saved = toPreferenceRecords({ ownerUserNo: "user-1", salaryGroupId: "group-1", salaryCycle: "202607", columns: [{ key: "BASEPAY", label: "基本工资", group: "应发工资", secondGroup: "固定收入", printFlag: true, order: 200 }] });
  const groups = groupColumnsByTopGroup([
    { key: "STFNAM", group: "基础信息" },
    { key: "BASEPAY", group: "应发工资" },
    { key: "BONUS", group: "应发工资" }
  ]);

  assert.equal(preferences[0].secondGroup, "固定收入");
  assert.equal(saved[0].second_group, "固定收入");
  assert.deepEqual(groups.map((group) => [group.label, group.columns.length]), [["基础信息", 1], ["应发工资", 2]]);
});

test("flattens the category header endpoint into printable first and second headers", () => {
  const headers = flattenCategoryHeaders([
    { categoryName: "人事信息", categoryShow: "Y", itemHeaders: [{ itemKey: "STFNAM", itemName: "姓名" }] },
    { categoryName: "统计项目", categoryShow: "Y", itemHeaders: [{ itemKey: "GRSPAY", itemName: "应发工资" }] }
  ]);

  assert.deepEqual(headers.map((header) => [header.itemKey, header.itemName, header.categoryName, header.checkedStatus, header.totalHeadFlag]), [
    ["STFNAM", "姓名", "人事信息", "Y", "N"],
    ["GRSPAY", "应发工资", "统计项目", "Y", "Y"]
  ]);
});

test("uses the category endpoint as the authoritative first header for existing preferences", () => {
  const columns = buildColumns([{ itemKey: "STFNAM", itemName: "姓名", categoryName: "人事信息", checkedStatus: "Y", totalHeadFlag: "N" }], [{ columnKey: "STFNAM", topGroup: "旧分组" }]);

  assert.equal(columns[0].group, "人事信息");
});

test("moves an entire first-level header group and rewrites its display order", () => {
  const moved = moveGroup([
    { key: "STFNAM", group: "人事信息", order: 100 },
    { key: "BASEPAY", group: "基本工资项目", order: 200 },
    { key: "ALLOW", group: "基本工资项目", order: 300 },
    { key: "NETPAY", group: "统计项目", order: 400 }
  ], "统计项目", -1);

  assert.deepEqual(moved.map((column) => [column.key, column.order]), [["STFNAM", 100], ["NETPAY", 200], ["BASEPAY", 300], ["ALLOW", 400]]);
});

test("moves a second-level header only inside its first-level group", () => {
  const moved = moveColumnWithinGroup([
    { key: "STFNAM", group: "人事信息", order: 100 },
    { key: "BASEPAY", group: "基本工资项目", order: 200 },
    { key: "ALLOW", group: "基本工资项目", order: 300 },
    { key: "NETPAY", group: "统计项目", order: 400 }
  ], "ALLOW", -1);

  assert.deepEqual(moved.map((column) => [column.key, column.order]), [["STFNAM", 100], ["ALLOW", 200], ["BASEPAY", 300], ["NETPAY", 400]]);
});

test("persists a drag-derived column order with normalized display values", () => {
  const ordered = orderColumnsByKeys([
    { key: "STFNAM", order: 100 },
    { key: "BASEPAY", order: 200 },
    { key: "NETPAY", order: 300 }
  ], ["NETPAY", "STFNAM", "BASEPAY"]);

  assert.deepEqual(ordered.map((column) => [column.key, column.order]), [["NETPAY", 100], ["STFNAM", 200], ["BASEPAY", 300]]);
});
