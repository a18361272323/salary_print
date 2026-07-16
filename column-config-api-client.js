(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintColumnConfigApiClient = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function flag(value) { return value ? 1 : 0; }

  function createColumnConfigApiClient(options) {
    var settings = options || {};
    if (typeof settings.run !== "function") throw new Error("列配置 API 客户端配置不完整");

    return {
      save: async function (input) {
        var source = input || {};
        var columns = Array.isArray(source.columns) ? source.columns : [];
        var payload = {
          salaryGroupId: source.salaryGroupId,
          salaryCycle: source.salaryCycle,
          columns: columns.map(function (column) {
            return {
              columnKey: column.key,
              printFlag: flag(column.printFlag),
              displayOrder: Number(column.order),
              topGroup: column.group || "",
              secondGroup: column.secondGroup || "",
              totalFlag: flag(column.totalFlag)
            };
          })
        };
        var response = await settings.run(payload);
        if (!response || !Number.isFinite(Number(response.savedCount))) throw new Error("列配置 API 未返回保存数量");
        if (!Array.isArray(response.records)) throw new Error("列配置 API 未返回 records");
        return { savedCount: Number(response.savedCount), records: response.records, version: response.version };
      }
    };
  }

  return { createColumnConfigApiClient: createColumnConfigApiClient };
});
