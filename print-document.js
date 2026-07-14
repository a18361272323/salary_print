(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintDocument = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createPrintDocument(options) {
    var config = options || {};
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + String(config.title || "工资表") + '</title><link rel="stylesheet" href="' + String(config.cssHref || "") + '"></head><body class="standalone-print"><main class="print-pages">' + String(config.pagesHtml || "") + '</main><script>window.onload=function(){window.focus();window.print();};</script></body></html>';
  }
  return { createPrintDocument: createPrintDocument };
});
