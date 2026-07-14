(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var baseKeys = new Set(["STFNAM", "STFNBR", "STFIDN", "ORGNAM", "POSNAM", "STFTYP", "STFSTS", "ENTDAT", "CORDAT", "QUTDAT"]);
  var requiredKeys = new Set(["STFNAM", "STFIDN", "GRSPAY", "NETPAY"]);

  function defaultGroup(header) {
    if (header.categoryName) return header.categoryName;
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
        group: header.categoryName || saved.topGroup || defaultGroup(header),
        secondGroup: saved.secondGroup || saved.columnLabelOverride || header.itemName,
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

  function groupColumnsByTopGroup(columns) {
    return (columns || []).reduce(function (groups, column) {
      var label = column.group || "未分组";
      var current = groups.find(function (group) { return group.label === label; });
      if (!current) {
        current = { label: label, columns: [] };
        groups.push(current);
      }
      current.columns.push(column);
      return groups;
    }, []);
  }

  function flattenGroups(groups) {
    return (groups || []).reduce(function (columns, group) { return columns.concat(group.columns || []); }, []);
  }

  function rewriteDisplayOrders(columns) {
    return (columns || []).map(function (column, index) { return Object.assign({}, column, { order: (index + 1) * 100 }); });
  }

  function moveGroup(columns, groupLabel, delta) {
    var groups = groupColumnsByTopGroup(columns);
    var index = groups.findIndex(function (group) { return group.label === groupLabel; });
    var target = index + Number(delta || 0);
    if (index < 0 || target < 0 || target >= groups.length) return rewriteDisplayOrders(flattenGroups(groups));
    var moved = groups.splice(index, 1)[0];
    groups.splice(target, 0, moved);
    return rewriteDisplayOrders(flattenGroups(groups));
  }

  function moveColumnWithinGroup(columns, columnKey, delta) {
    var groups = groupColumnsByTopGroup(columns);
    var targetGroup = groups.find(function (group) { return group.columns.some(function (column) { return column.key === columnKey; }); });
    if (!targetGroup) return rewriteDisplayOrders(flattenGroups(groups));
    var index = targetGroup.columns.findIndex(function (column) { return column.key === columnKey; });
    var target = index + Number(delta || 0);
    if (target >= 0 && target < targetGroup.columns.length) {
      var moved = targetGroup.columns.splice(index, 1)[0];
      targetGroup.columns.splice(target, 0, moved);
    }
    return rewriteDisplayOrders(flattenGroups(groups));
  }

  function flattenCategoryHeaders(categories) {
    return (categories || []).reduce(function (headers, category) {
      return headers.concat((category.itemHeaders || []).map(function (item) {
        return Object.assign({}, item, {
          categoryName: category.categoryName || "工资项目",
          checkedStatus: category.categoryShow === "N" ? "N" : "Y",
          totalHeadFlag: item.itemKey === "GRSPAY" || item.itemKey === "NETPAY" ? "Y" : "N"
        });
      }));
    }, []);
  }

  function fromPreferenceRecords(records) { return (records || []).map(function (record) { return { id: record.id, columnKey: record.column_key, printFlag: Number(record.print_flag) === 1, displayOrder: Number(record.display_order), topGroup: record.top_group, secondGroup: record.second_group, totalFlag: Number(record.total_flag) === 1, columnLabelOverride: record.column_label_override, widthMm: Number(record.width_mm) || undefined, alignMode: record.align_mode, maskFlag: Number(record.mask_flag) === 1 }; }); }
  function toPreferenceRecords(input) { var config = input || {}; return (config.columns || []).map(function (column) { return { config_scope: "personal", owner_user_no: config.ownerUserNo, salary_group_id: config.salaryGroupId, salary_cycle: config.salaryCycle, column_key: column.key, print_flag: column.printFlag ? 1 : 0, display_order: column.order, top_group: column.group || "", second_group: column.secondGroup || column.label || "", column_label_override: column.label || "", width_mm: column.widthMm || column.minWidthMm || null, vertical_text: 0, align_mode: column.alignMode || "center", data_type: "text", total_flag: column.totalFlag ? 1 : 0, mask_flag: column.maskFlag ? 1 : 0, sort_priority: 0, sort_direction: "ascending", enabled: 1, remark: "" }; }); }

  return { buildColumns: buildColumns, normalizeRows: normalizeRows, calculateTotals: calculateTotals, groupColumnsByTopGroup: groupColumnsByTopGroup, moveGroup: moveGroup, moveColumnWithinGroup: moveColumnWithinGroup, flattenCategoryHeaders: flattenCategoryHeaders, minimumPrintWidth: minimumPrintWidth, fromPreferenceRecords: fromPreferenceRecords, toPreferenceRecords: toPreferenceRecords };
});
