const assert = require("node:assert/strict");
const test = require("node:test");

const { renderPrintPages } = require("../print-renderer");

test("renders a consolidated salary title without duplicated group or cycle metadata", () => {
  const html = renderPrintPages({
    pages: [
      { kind: "first", rows: [{ STFNAM: "甲", NETPAY: 10 }] },
      { kind: "last", rows: [{ STFNAM: "乙", NETPAY: 20 }], includeSummary: true }
    ],
    columns: [{ key: "STFNAM", label: "姓名" }, { key: "NETPAY", label: "实发工资", alignMode: "right", totalFlag: true }],
    totals: { NETPAY: 30 },
    title: "2026年7月一组工资表",
    groupName: "一组",
    cycleName: "202607"
  });

  assert.match(html, /2026年7月一组工资表/);
  assert.match(html, /工资表（续表）/);
  assert.doesNotMatch(html, /薪资组：/);
  assert.doesNotMatch(html, /薪资所属期：/);
  assert.doesNotMatch(html, /202607/);
  assert.equal((html.match(/制表：/g) || []).length, 1);
  assert.match(html, /30\.00/);
  assert.match(html, /第 1 页 \/ 共 2 页/);
  assert.match(html, /第 2 页 \/ 共 2 页/);
});
