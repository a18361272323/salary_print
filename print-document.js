(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintDocument = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createPrintDocument(options) {
    var config = options || {};
    var allowedPapers = { "A4 landscape": true, "A3 landscape": true, "B4 landscape": true, "A4 portrait": true };
    var paper = allowedPapers[config.paper] ? config.paper : "A4 landscape";
    var fontPt = Number(config.fontPt) || 9;
    var printCss = '<style>@page{size:' + paper + ';margin:9mm}:root{--print-font:' + fontPt + 'pt}html,body.standalone-print{margin:0;background:#fff!important;color:#000;font-family:"SimSun","宋体",serif}.standalone-print .print-pages{display:block}.standalone-print .print-page{background:#fff!important;box-shadow:none!important;padding:0;margin:0;min-height:0}.standalone-print th,.standalone-print td{border:1px solid #000!important;text-align:center!important;vertical-align:middle!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere;word-break:break-word}.standalone-print .right{text-align:center!important}.standalone-print .group-header th,.standalone-print .column-header th{border:1.5px solid #000!important;font-size:11pt;font-weight:700;background:#fff!important}.standalone-print tfoot td{background:#f0f0f0!important}tbody tr,tfoot,.signature{break-inside:avoid;page-break-inside:avoid}</style>';
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + String(config.title || "工资表") + '</title><link rel="stylesheet" href="' + String(config.cssHref || "") + '">' + printCss + '</head><body class="standalone-print"><main class="print-pages">' + String(config.pagesHtml || "") + '</main><script>window.onload=function(){window.focus();window.print();};</script></body></html>';
  }
  return { createPrintDocument: createPrintDocument };
});
