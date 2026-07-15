(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) { return String(value === undefined || value === null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function renderHeaderRows(columns) {
    var groups = [];
    (columns || []).forEach(function (column) {
      var label = column.group;
      var current = groups[groups.length - 1];
      if (!label) {
        groups.push({ label: "", columns: [column] });
        return;
      }
      if (!current || current.label !== label) {
        current = { label: label, columns: [] };
        groups.push(current);
      }
      current.columns.push(column);
    });
    var first = '<tr class="group-header">' + groups.map(function (group) {
      if (!group.label) return '<th rowspan="2">' + escapeHtml(group.columns[0].label) + "</th>";
      return '<th colspan="' + group.columns.length + '">' + escapeHtml(group.label) + "</th>";
    }).join("") + "</tr>";
    var secondColumns = (columns || []).filter(function (column) { return Boolean(column.group); });
    var second = '<tr class="column-header">' + secondColumns.map(function (column) { return "<th>" + escapeHtml(column.label) + "</th>"; }).join("") + "</tr>";
    return first + second;
  }
  function renderColumnWidths(columns) {
    var total = (columns || []).reduce(function (sum, column) { return sum + Number(column.widthMm || column.minWidthMm || 18); }, 0) || 1;
    return "<colgroup>" + (columns || []).map(function (column) { return '<col style="width:' + (Number(column.widthMm || column.minWidthMm || 18) / total * 100).toFixed(2) + '%">'; }).join("") + "</colgroup>";
  }
  function renderSignature() {
    return '<footer class="signature"><span>制表：_______________</span><span>审核：_______________</span><span>部门负责人：_______________</span><span>主管领导：_______________</span></footer>';
  }
  function formatValue(value, column) {
    if (value === undefined || value === null || value === "") return "";
    var type = String(column.itemShowType || "").toUpperCase();
    var label = String(column.label || "");
    var numeric = Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return String(value);
    if (type === "DEC") {
      var decimals = /^\d+$/.test(String(column.itemShowFormat || "")) ? Number(column.itemShowFormat) : 2;
      return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(numeric);
    }
    if (type === "INT" || type === "INTEGER" || /天数|天/.test(label)) return String(Math.round(numeric));
    return String(value);
  }
  function cellClass(column) { return (column.alignMode === "right" || column.itemShowType === "DEC" || column.totalFlag) ? "right" : ""; }
  function renderPrintPages(input) {
    var config = input || {}; var pages = config.pages || []; var columns = config.columns || []; var totals = config.totals || {};
    return pages.map(function (page) {
      var isFirst = page.kind === "first" || page.kind === "first-last";
      var isLast = Boolean(page.includeSummary);
      var rows = (page.rows || []).map(function (row) { return "<tr>" + columns.map(function (column) { return '<td class="' + cellClass(column) + '">' + escapeHtml(formatValue(row[column.key], column)) + "</td>"; }).join("") + "</tr>"; }).join("");
      var header = isFirst ? '<div class="print-title"><h2>' + escapeHtml(config.title) + "</h2></div>" : '<div class="continuation-title">工资表（续表）</div>';
      var summary = isLast ? '<tfoot><tr>' + columns.map(function (column, columnIndex) { return '<td class="' + cellClass(column) + '">' + (columnIndex === 0 ? "合计" : (column.totalFlag ? formatValue(totals[column.key] || 0, Object.assign({}, column, { itemShowType: column.itemShowType || "DEC" })) : "")) + "</td>"; }).join("") + "</tr></tfoot>" : "";
      var signature = isLast ? renderSignature() : "";
      return '<section class="print-page print-page--' + page.kind + '">' + header + '<table>' + renderColumnWidths(columns) + '<thead>' + renderHeaderRows(columns) + "</thead><tbody>" + rows + "</tbody>" + summary + "</table>" + signature + "</section>";
    }).join("");
  }
  return { renderPrintPages: renderPrintPages };
});
