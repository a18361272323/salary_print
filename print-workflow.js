(function (root, factory) {
  var loader = root.SalaryPrintDataLoader;
  var layout = root.SalaryPrintLayout;
  if (typeof module === "object" && module.exports) {
    loader = loader || require("./salary-data-loader");
    layout = layout || require("./print-layout");
  }
  var api = factory(loader, layout);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (loader, layout) {
  async function preparePrintDocument(input) {
    var config = input || {};
    if (!loader || !layout) throw new Error("打印工作流依赖未加载");
    var loaded = await loader.loadAllSalaryRows(config.loader || {});
    var visibleColumns = (config.columns || []).filter(function (column) { return column.printFlag; });
    var fit = layout.evaluatePaperFit({ paper: config.paper, columns: visibleColumns });
    if (fit.status !== "fit") return { canPrint: false, fit: fit, loaded: loaded, pages: [] };
    var pageLayout = config.pageLayout || layout.derivePageCapacity(fit.paper, fit.fontPt);
    var pages = layout.paginatePrintRows({ rows: loaded.records, layout: pageLayout });
    return { canPrint: true, fit: fit, loaded: loaded, pages: pages };
  }

  return { preparePrintDocument: preparePrintDocument };
});
