(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintMonthPicker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toMonthKey(date) { return date.getFullYear() + String(date.getMonth() + 1).padStart(2, "0"); }
  function shiftMonth(key, delta) { var year = Number(key.slice(0, 4)); var month = Number(key.slice(4, 6)) - 1 + Number(delta); var date = new Date(year, month, 1); return toMonthKey(date); }
  function canSelectMonth(key, nowKey) { return String(key) <= String(nowKey); }
  function formatMonthLabel(key) { return key.slice(0, 4) + " 年 " + key.slice(4, 6) + " 月"; }
  return { toMonthKey: toMonthKey, shiftMonth: shiftMonth, canSelectMonth: canSelectMonth, formatMonthLabel: formatMonthLabel };
});
