(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintDocument = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createPrintDocument(options) {
    var config = options || {};
    var allowedPapers = { "A4 landscape": true, "A3 landscape": true, "A4 portrait": true };
    var paper = allowedPapers[config.paper] ? config.paper : "A4 landscape";
    var fontPt = Number(config.fontPt) || 9;
    var printCss = '<style>@page{size:' + paper + ';margin:9mm}:root{--print-font:' + fontPt + 'pt}html,body.standalone-print{margin:0;background:#fff!important}.standalone-print .print-pages{display:block}.standalone-print .print-page{background:#fff!important;box-shadow:none!important;padding:0;margin:0;min-height:0}.standalone-print th,.standalone-print td{border-color:#000!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere;word-break:break-word}.standalone-print .right{text-align:center!important}.standalone-print .group-header th,.standalone-print .column-header th,.standalone-print tfoot td{background:#fff!important}</style>';
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + String(config.title || "工资表") + '</title><link rel="stylesheet" href="' + String(config.cssHref || "") + '">' + printCss + '</head><body class="standalone-print"><main class="print-pages">' + String(config.pagesHtml || "") + '</main><script>window.onload=function(){window.focus();window.print();};</script></body></html>';
  }
  return { createPrintDocument: createPrintDocument };
});
