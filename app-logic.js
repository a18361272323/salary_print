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

  function fromPreferenceRecords(records) { return (records || []).map(function (record) { return { id: record.id, columnKey: record.column_key, printFlag: Number(record.print_flag) === 1, displayOrder: Number(record.display_order), topGroup: record.top_group, totalFlag: Number(record.total_flag) === 1, columnLabelOverride: record.column_label_override, widthMm: Number(record.width_mm) || undefined, alignMode: record.align_mode, maskFlag: Number(record.mask_flag) === 1 }; }); }
  function toPreferenceRecords(input) { var config = input || {}; return (config.columns || []).map(function (column) { return { config_scope: "personal", owner_user_no: config.ownerUserNo, salary_group_id: config.salaryGroupId, salary_cycle: config.salaryCycle, column_key: column.key, print_flag: column.printFlag ? 1 : 0, display_order: column.order, top_group: column.group || "", second_group: "", column_label_override: column.label || "", width_mm: column.widthMm || column.minWidthMm || null, vertical_text: 0, align_mode: column.alignMode || "center", data_type: "text", total_flag: column.totalFlag ? 1 : 0, mask_flag: column.maskFlag ? 1 : 0, sort_priority: 0, sort_direction: "ascending", enabled: 1, remark: "" }; }); }

  return { buildColumns: buildColumns, normalizeRows: normalizeRows, calculateTotals: calculateTotals, minimumPrintWidth: minimumPrintWidth, fromPreferenceRecords: fromPreferenceRecords, toPreferenceRecords: toPreferenceRecords };
});
