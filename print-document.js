(function (root, factory) {
  var api = factory(function () {
    var layoutConfig = root.SalaryPrintLayoutConfig;
    if (typeof module === "object" && module.exports) layoutConfig = layoutConfig || require("./layout-config");
    return { layoutConfig: layoutConfig };
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintDocument = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (getDependencies) {
  function safeLayoutCssVariables(value, layoutConfig) {
    if (typeof value !== "string") return "";
    var allowed = Object.create(null);
    if (layoutConfig) layoutConfig.toLayoutCssVariables({}).split(";").forEach(function (declaration) { allowed[declaration.split(":")[0]] = true; });
    return value.split(";").map(function (declaration) {
      var separator = declaration.indexOf(":");
      var name = declaration.slice(0, separator);
      var cssValue = declaration.slice(separator + 1);
      return separator > 0 && allowed[name] && /^[#A-Za-z0-9 .-]+$/.test(cssValue) ? name + ":" + cssValue : "";
    }).filter(Boolean).join(";");
  }
  function createPrintDocument(options) {
    var config = options || {};
    var allowedPapers = { "A4 landscape": true, "A3 landscape": true, "B4 landscape": true, "A4 portrait": true };
    var paper = allowedPapers[config.paper] ? config.paper : "A4 landscape";
    var fontPt = Number(config.fontPt) || 9;
    var layoutConfig = getDependencies().layoutConfig;
    var layout = layoutConfig ? layoutConfig.normalizeLayout(config.layout) : null;
    var normalizedMargin = layoutConfig && config.pageMarginMm !== undefined ? layoutConfig.normalizeLayout({ page: { marginMm: config.pageMarginMm } }).page.marginMm : undefined;
    var marginMm = normalizedMargin !== undefined ? normalizedMargin : (layout ? layout.page.marginMm : 9);
    var layoutCssVariables = layoutConfig && config.layout ? layoutConfig.toLayoutCssVariables(layout) : safeLayoutCssVariables(config.layoutCssVariables, layoutConfig);
    var rootVariables = '--print-font:' + fontPt + 'pt' + (layoutCssVariables ? ";" + layoutCssVariables : "");
    var printCss = '<style>@page{size:' + paper + ';margin:' + marginMm + 'mm}:root{' + rootVariables + '}html,body.standalone-print{margin:0;background:#fff!important;color:var(--salary-body-color,#000)!important;font-family:var(--salary-body-font-family,"SimSun"),"宋体",serif}.standalone-print .print-pages{display:block}.standalone-print .print-page{background:#fff!important;box-shadow:none!important;padding:0;margin:0;min-height:0}.standalone-print .print-title h2{font-family:var(--salary-title-font-family,"SimSun"),serif;font-size:var(--salary-title-size,20pt);color:var(--salary-title-color,#000);text-decoration:var(--salary-title-underline,underline)}.standalone-print th,.standalone-print td{border:1px solid #000!important;border:var(--salary-border-width,1px) var(--salary-border-style,solid) var(--salary-border-color,#000)!important;text-align:center!important;vertical-align:middle!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere;word-break:break-word}.standalone-print .right{text-align:center!important}.standalone-print .group-header th,.standalone-print .column-header th{border:1.5px solid #000!important;font-size:11pt;font-weight:700;background:#fff!important}.standalone-print .group-header th{font-family:var(--salary-group-header-font-family,"SimSun"),serif;font-size:var(--salary-group-header-size,11pt);font-weight:var(--salary-group-header-weight,700);color:var(--salary-group-header-color,#000);height:var(--salary-group-header-row-height,28px)}.standalone-print .column-header th{font-family:var(--salary-field-header-font-family,"SimSun"),serif;font-size:var(--salary-field-header-size,11pt);font-weight:var(--salary-field-header-weight,700);color:var(--salary-field-header-color,#000);height:var(--salary-field-header-row-height,28px)}.standalone-print tbody tr{height:var(--salary-body-row-height,20px);font-family:var(--salary-body-font-family,"SimSun"),serif;font-size:var(--salary-body-size,9pt);color:var(--salary-body-color,#000)}.standalone-print tfoot{height:var(--salary-total-row-height,20px);font-family:var(--salary-total-font-family,"SimSun"),serif;font-size:var(--salary-total-size,9pt);color:var(--salary-total-color,#000);background:#f0f0f0!important}.standalone-print .signature{min-height:var(--salary-signature-height,6mm);font-family:var(--salary-signature-font-family,"SimSun"),serif;font-size:var(--salary-signature-size,9pt);color:var(--salary-signature-color,#000)}tbody tr,tfoot,.signature{break-inside:avoid;page-break-inside:avoid}</style>';
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + String(config.title || "工资表") + '</title><link rel="stylesheet" href="' + String(config.cssHref || "") + '">' + printCss + '</head><body class="standalone-print"><main class="print-pages">' + String(config.pagesHtml || "") + '</main><script>window.onload=function(){window.focus();window.print();};</script></body></html>';
  }
  return { createPrintDocument: createPrintDocument };
});
