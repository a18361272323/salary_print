(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var baseKeys = new Set(["STFNAM", "STFNBR", "STFIDN", "ORGNAM", "POSNAM", "STFTYP", "STFSTS", "ENTDAT", "CORDAT", "QUTDAT"]);
  var requiredKeys = new Set(["STFNAM", "STFIDN", "GRSPAY", "NETPAY"]);

  function defaultGroup(header) {
    if (baseKeys.has(header.itemKey)) return "基础信息";
    if (header.itemKey === "GRSPAY") return "应发工资";
    if (header.itemKey === "NETPAY") return "实发工资";
    return "工资项目";
  }

  function minimumPrintWidth(header) {
    if (header.itemKey === "STFNAM") return 28;
    if (header.itemKey === "STFIDN") return 34;
    if (header.itemKey === "GRSPAY" || header.itemKey === "NETPAY" || header.totalHeadFlag === "Y") return 20;
    return 18;
  }

  function buildColumns(headers, preferences) {
    var lookup = new Map((preferences || []).map(function (item) { return [item.columnKey, item]; }));
    return (headers || []).map(function (header, index) {
      var saved = lookup.get(header.itemKey) || {};
      return {
        key: header.itemKey,
        label: saved.columnLabelOverride || header.itemName,
        group: saved.topGroup || defaultGroup(header),
        printFlag: saved.printFlag === undefined ? header.checkedStatus === "Y" : saved.printFlag,
        order: Number.isFinite(saved.displayOrder) ? saved.displayOrder : (index + 1) * 100,
        totalFlag: saved.totalFlag === undefined ? header.totalHeadFlag === "Y" : saved.totalFlag,
        minWidthMm: saved.widthMm || minimumPrintWidth(header),
        widthMm: saved.widthMm || minimumPrintWidth(header),
        alignMode: saved.alignMode || (header.totalHeadFlag === "Y" ? "right" : "center"),
        maskFlag: Boolean(saved.maskFlag),
        optional: !baseKeys.has(header.itemKey) && !requiredKeys.has(header.itemKey)
      };
    }).sort(function (left, right) { return left.order - right.order; });
  }

  function normalizeRows(records, columns) {
    return (records || []).map(function (record) {
      var details = {};
      try { details = JSON.parse(record.salaryData || "{}"); } catch (_) { details = {}; }
      var row = { _id: record.uniqueId || record.staffId || Math.random().toString(36) };
      (columns || []).forEach(function (column) { row[column.key] = details[column.key] !== undefined ? details[column.key] : (record[column.key] || ""); });
      return row;
    });
  }

  function calculateTotals(rows, columns) {
    return (columns || []).reduce(function (totals, column) {
      if (!column.totalFlag) return totals;
      totals[column.key] = (rows || []).reduce(function (sum, row) { return sum + (Number(String(row[column.key]).replace(/,/g, "")) || 0); }, 0);
      return totals;
    }, {});
  }

  return { buildColumns: buildColumns, normalizeRows: normalizeRows, calculateTotals: calculateTotals, minimumPrintWidth: minimumPrintWidth };
});
