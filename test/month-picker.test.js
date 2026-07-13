const assert = require("node:assert/strict");
const test = require("node:test");
const { canSelectMonth, formatMonthLabel, shiftMonth, toMonthKey } = require("../month-picker");

test("formats a single month as a YYYYMM business value and Chinese label", () => {
  assert.equal(toMonthKey(new Date(2026, 6, 13)), "202607");
  assert.equal(formatMonthLabel("202607"), "2026 年 07 月");
});

test("navigates to the previous month and blocks a future month", () => {
  assert.equal(shiftMonth("202601", -1), "202512");
  assert.equal(shiftMonth("202612", 1), "202701");
  assert.equal(canSelectMonth("202607", "202607"), true);
  assert.equal(canSelectMonth("202608", "202607"), false);
});
