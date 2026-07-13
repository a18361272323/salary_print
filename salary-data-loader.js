(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintDataLoader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  async function loadAllSalaryRows(options) {
    var config = options || {};
    if (typeof config.loadPage !== "function") throw new Error("工资分页加载器缺少 loadPage");
    var pageSize = Number(config.pageSize || 100);
    var records = [];
    var current = 1;
    var total = null;

    while (total === null || records.length < total) {
      if (config.isCancelled && config.isCancelled()) throw new Error("已取消加载工资表");
      var page = await config.loadPage({ current: current, size: pageSize });
      var pageRecords = page && Array.isArray(page.records) ? page.records : [];
      var nextTotal = Number(page && page.total);
      if (Number.isFinite(nextTotal)) total = nextTotal;
      if (total === null) total = records.length + pageRecords.length;
      if (!pageRecords.length && records.length < total) throw new Error("分页数据不完整：第 " + current + " 批未返回记录");
      records.push.apply(records, pageRecords);
      if (config.onProgress) config.onProgress({ loaded: records.length, total: total, current: current });
      current += 1;
    }

    return { records: records.slice(0, total), total: total, complete: true };
  }

  return { loadAllSalaryRows: loadAllSalaryRows };
});
