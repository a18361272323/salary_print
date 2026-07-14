(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) { return String(value === undefined || value === null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function renderPrintPages(input) {
    var config = input || {}; var pages = config.pages || []; var columns = config.columns || []; var totals = config.totals || {};
    return pages.map(function (page, index) {
      var isFirst = page.kind === "first" || page.kind === "first-last";
      var isLast = Boolean(page.includeSummary);
      var rows = (page.rows || []).map(function (row) { return "<tr>" + columns.map(function (column) { return '<td class="' + (column.alignMode === "right" ? "right" : "") + '">' + escapeHtml(row[column.key]) + "</td>"; }).join("") + "</tr>"; }).join("");
      var header = isFirst ? '<div class="print-title"><h2>' + escapeHtml(config.title) + "</h2></div>" : '<div class="continuation-title">工资表（续表）</div>';
      var summary = isLast ? '<tfoot><tr>' + columns.map(function (column, columnIndex) { return '<td class="' + (column.alignMode === "right" ? "right" : "") + '">' + (columnIndex === 0 ? "合计" : (column.totalFlag ? Number(totals[column.key] || 0).toFixed(2) : "")) + "</td>"; }).join("") + '</tr></tfoot><footer class="signature">制表：_______________　审核：_______________　部门负责人：_______________　主管领导：_______________</footer>' : "";
      return '<section class="print-page print-page--' + page.kind + '">' + header + '<table><thead><tr>' + columns.map(function (column) { return "<th>" + escapeHtml(column.label) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody>" + summary + '</table><div class="page-footer">第 ' + (index + 1) + " 页 / 共 " + pages.length + " 页　第 " + (page.rows.length ? page.rows[0]._sequence : 0) + "–" + (page.rows.length ? page.rows[page.rows.length - 1]._sequence : 0) + " 条 / 共 " + (config.totalRows || 0) + " 条</div></section>";
    }).join("");
  }
  return { renderPrintPages: renderPrintPages };
});
