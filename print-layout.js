(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var PAPERS = {
    "A4 landscape": { widthMm: 279, heightMm: 192, preferredFontPt: 9 },
    "A3 landscape": { widthMm: 402, heightMm: 279, preferredFontPt: 9 },
    "A4 portrait": { widthMm: 192, heightMm: 279, preferredFontPt: 9 }
  };

  function getPaper(paper) {
    var spec = PAPERS[paper];
    if (!spec) throw new Error("不支持的纸张规格：" + paper);
    return spec;
  }

  function evaluatePaperFit(input) {
    var config = input || {};
    var paper = config.paper || "A4 landscape";
    var spec = getPaper(paper);
    var requiredWidthMm = (config.columns || []).reduce(function (total, column) { return total + Number(column.minWidthMm || 18); }, 0);
    var ratio = requiredWidthMm ? spec.widthMm / requiredWidthMm : 1;
    var fontPt = Math.max(6.5, Math.floor(Math.min(1, ratio) * spec.preferredFontPt * 2) / 2);
    var scaledWidthMm = requiredWidthMm * fontPt / spec.preferredFontPt;

    if (scaledWidthMm <= spec.widthMm) return { status: "fit", paper: paper, fontPt: fontPt, requiredWidthMm: requiredWidthMm };
    if (paper !== "A3 landscape") return { status: "suggest-a3", paper: paper, fontPt: 6.5, suggestedPaper: "A3 landscape", requiredWidthMm: requiredWidthMm };
    return { status: "adjust-columns", paper: paper, fontPt: 6.5, requiredWidthMm: requiredWidthMm };
  }

  function derivePageCapacity(paper, fontPt) {
    var spec = getPaper(paper);
    var rowHeightMm = 7 * Number(fontPt || spec.preferredFontPt) / spec.preferredFontPt;
    function rows(reservedHeightMm) { return Math.max(1, Math.floor((spec.heightMm - reservedHeightMm) / rowHeightMm)); }
    return { firstPageRows: rows(55), middlePageRows: rows(25), lastPageRows: rows(70) };
  }

  function paginatePrintRows(input) {
    var config = input || {};
    var rows = config.rows || [];
    var layout = config.layout || {};
    var firstCapacity = Math.max(1, Number(layout.firstPageRows || 1));
    var middleCapacity = Math.max(1, Number(layout.middlePageRows || 1));
    var lastCapacity = Math.max(1, Number(layout.lastPageRows || 1));
    if (rows.length <= firstCapacity) return [{ kind: "first-last", rows: rows.slice(), includeSummary: true }];

    var beforeLastCount = Math.max(0, rows.length - lastCapacity);
    var pages = [];
    var offset = 0;
    var firstCount = Math.min(firstCapacity, beforeLastCount);
    pages.push({ kind: "first", rows: rows.slice(offset, offset + firstCount), includeSummary: false });
    offset += firstCount;
    while (offset < beforeLastCount) {
      var count = Math.min(middleCapacity, beforeLastCount - offset);
      pages.push({ kind: "middle", rows: rows.slice(offset, offset + count), includeSummary: false });
      offset += count;
    }
    pages.push({ kind: "last", rows: rows.slice(offset), includeSummary: true });
    return pages;
  }

  return { PAPERS: PAPERS, evaluatePaperFit: evaluatePaperFit, derivePageCapacity: derivePageCapacity, paginatePrintRows: paginatePrintRows };
});
