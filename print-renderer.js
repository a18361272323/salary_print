(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) { return String(value === undefined || value === null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function renderGroupHeader(columns) {
    var groups = (columns || []).reduce(function (result, column) {
      var label = column.group || "工资项目";
      var current = result[result.length - 1];
      if (!current || current.label !== label) {
        current = { label: label, count: 0 };
        result.push(current);
      }
      current.count += 1;
      return result;
    }, []);
    return '<tr class="group-header">' + groups.map(function (group) { return '<th colspan="' + group.count + '">' + escapeHtml(group.label) + "</th>"; }).join("") + "</tr>";
  }
  function renderColumnWidths(columns) {
    var total = (columns || []).reduce(function (sum, column) { return sum + Number(column.widthMm || column.minWidthMm || 18); }, 0) || 1;
    return "<colgroup>" + (columns || []).map(function (column) { return '<col style="width:' + (Number(column.widthMm || column.minWidthMm || 18) / total * 100).toFixed(2) + '%">'; }).join("") + "</colgroup>";
  }
  function renderSignature() {
    return '<footer class="signature"><span>制表：_______________</span><span>审核：_______________</span><span>部门负责人：_______________</span><span>主管领导：_______________</span></footer>';
  }
  function renderPrintPages(input) {
    var config = input || {}; var pages = config.pages || []; var columns = config.columns || []; var totals = config.totals || {};
    return pages.map(function (page) {
      var isFirst = page.kind === "first" || page.kind === "first-last";
      var isLast = Boolean(page.includeSummary);
      var rows = (page.rows || []).map(function (row) { return "<tr>" + columns.map(function (column) { return '<td class="' + (column.alignMode === "right" ? "right" : "") + '">' + escapeHtml(row[column.key]) + "</td>"; }).join("") + "</tr>"; }).join("");
      var header = isFirst ? '<div class="print-title"><h2>' + escapeHtml(config.title) + "</h2></div>" : '<div class="continuation-title">工资表（续表）</div>';
      var summary = isLast ? '<tfoot><tr>' + columns.map(function (column, columnIndex) { return '<td class="' + (column.alignMode === "right" ? "right" : "") + '">' + (columnIndex === 0 ? "合计" : (column.totalFlag ? Number(totals[column.key] || 0).toFixed(2) : "")) + "</td>"; }).join("") + "</tr></tfoot>" : "";
      var signature = isLast ? renderSignature() : "";
      return '<section class="print-page print-page--' + page.kind + '">' + header + '<table>' + renderColumnWidths(columns) + '<thead>' + renderGroupHeader(columns) + '<tr class="column-header">' + columns.map(function (column) { return "<th>" + escapeHtml(column.label) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody>" + summary + "</table>" + signature + "</section>";
    }).join("");
  }
  return { renderPrintPages: renderPrintPages };
});
