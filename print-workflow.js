(function (root, factory) {
  var api = factory(function () {
    var loader = root.SalaryPrintDataLoader;
    var layout = root.SalaryPrintLayout;
    var layoutConfig = root.SalaryPrintLayoutConfig;
    if (typeof module === "object" && module.exports) {
      loader = loader || require("./salary-data-loader");
      layout = layout || require("./print-layout");
      layoutConfig = layoutConfig || require("./layout-config");
    }
    return { loader: loader, layout: layout, layoutConfig: layoutConfig };
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (getDependencies) {
  async function preparePrintDocument(input) {
    var config = input || {};
    var dependencies = getDependencies();
    var loader = dependencies.loader;
    var layout = dependencies.layout;
    var layoutConfig = dependencies.layoutConfig;
    if (!loader || !layout) throw new Error("打印工作流依赖未加载");
    var loaded = await loader.loadAllSalaryRows(config.loader || {});
    var effectiveLayout = layoutConfig ? layoutConfig.normalizeLayout(config.layout) : (config.layout || {});
    var visibleColumns = (config.columns || []).filter(function (column) { return column.printFlag; });
    var columns = layoutConfig ? layoutConfig.applyColumnWidths(visibleColumns, effectiveLayout).columns : visibleColumns.map(function (column) { return Object.assign({}, column); });
    var fitColumns = columns.map(function (column) {
      var widthMm = Number(column.widthMm);
      return Number.isFinite(widthMm) ? Object.assign({}, column, { minWidthMm: widthMm }) : column;
    });
    var pageMarginMm = effectiveLayout.page && effectiveLayout.page.marginMm;
    var fit = layout.evaluatePaperFit({ paper: config.paper, columns: fitColumns, marginMm: pageMarginMm });
    if (fit.status !== "fit") return { canPrint: false, fit: fit, loaded: loaded, pages: [] };
    var pageLayout = config.pageLayout || layout.derivePageCapacity(fit.paper, fit.fontPt, { marginMm: pageMarginMm });
    var pages = layout.paginatePrintRows({ rows: loaded.records, layout: pageLayout });
    return {
      canPrint: true,
      fit: fit,
      loaded: loaded,
      pages: pages,
      columns: columns,
      layout: effectiveLayout,
      layoutCssVariables: layoutConfig ? layoutConfig.toLayoutCssVariables(effectiveLayout) : "",
      pageMarginMm: pageMarginMm
    };
  }

  return { preparePrintDocument: preparePrintDocument };
});
