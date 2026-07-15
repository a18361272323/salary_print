const assert = require("node:assert/strict");
const test = require("node:test");

const { renderPrintPages } = require("../print-renderer");

test("renders a consolidated salary title without duplicated group or cycle metadata", () => {
  const html = renderPrintPages({
    pages: [
      { kind: "first", rows: [{ STFNAM: "甲", NETPAY: 10 }] },
      { kind: "last", rows: [{ STFNAM: "乙", NETPAY: 20 }], includeSummary: true }
    ],
    columns: [
      { key: "STFNAM", label: "姓名", group: "基础信息", widthMm: 24 },
      { key: "BASEPAY", label: "基本工资", group: "应发工资", widthMm: 18, alignMode: "right" },
      { key: "BONUS", label: "奖金", group: "应发工资", widthMm: 18, alignMode: "right" },
      { key: "NETPAY", label: "实发工资", group: "实发工资", widthMm: 20, alignMode: "right", totalFlag: true }
    ],
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
  assert.match(html, /<tr class="group-header"><th colspan="1">基础信息<\/th><th colspan="2">应发工资<\/th><th colspan="1">实发工资<\/th><\/tr>/);
  assert.match(html, /<colgroup><col style="width:30\.00%"><col style="width:22\.50%"><col style="width:22\.50%"><col style="width:25\.00%"><\/colgroup>/);
  assert.equal((html.match(/制表：/g) || []).length, 1);
  assert.match(html, /<\/table><footer class="signature">/);
  assert.match(html, /30\.00/);
  assert.doesNotMatch(html, /第 \d+ 页 \/ 共 \d+ 页/);
  assert.match(html, /<td class="right">10<\/td>/);
});
