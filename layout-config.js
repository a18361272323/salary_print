(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintLayoutConfig = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var PAPERS = ["A3 landscape", "A4 landscape", "B4 landscape", "A4 portrait"];
  var FONT_FAMILIES = ["SimSun", "Arial"];
  var HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  function createDefaultLayout() {
    return {
      page: { paper: "A3 landscape", marginMm: 9 },
      title: { fontFamily: "SimSun", fontSizePt: 20, color: "#000000", underline: true },
      groupHeader: { fontFamily: "SimSun", fontSizePt: 11, color: "#000000", bold: true, rowHeightPx: 28 },
      fieldHeader: { fontFamily: "SimSun", fontSizePt: 11, color: "#000000", bold: true, rowHeightPx: 28 },
      body: { fontFamily: "SimSun", fontSizePt: 9, color: "#000000", rowHeightPx: 20 },
      total: { fontFamily: "SimSun", fontSizePt: 9, color: "#000000", rowHeightPx: 20 },
      border: { color: "#000000", widthPx: 1, style: "solid" },
      signature: { fontFamily: "SimSun", fontSizePt: 9, color: "#000000", heightMm: 6 },
      columnWidthsByKey: {}
    };
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function numberInRange(value, minimum, maximum) {
    return typeof value === "number" && Number.isFinite(value) ? clamp(value, minimum, maximum) : undefined;
  }

  function normalizeColor(value) {
    return typeof value === "string" && HEX_COLOR.test(value) ? value.toUpperCase() : undefined;
  }

  function normalizePatch(source) {
    var input = isPlainObject(source) ? source : {};
    var patch = {};
    var page = input.page;
    if (isPlainObject(page)) {
      var normalizedPage = {};
      if (PAPERS.indexOf(page.paper) !== -1) normalizedPage.paper = page.paper;
      var margin = numberInRange(page.marginMm, 0, 20);
      if (margin !== undefined) normalizedPage.marginMm = margin;
      if (Object.keys(normalizedPage).length) patch.page = normalizedPage;
    }

    ["title", "groupHeader", "fieldHeader", "body", "total", "signature"].forEach(function (sectionName) {
      var section = input[sectionName];
      if (!isPlainObject(section)) return;
      var normalizedSection = {};
      if (typeof section.fontFamily === "string" && FONT_FAMILIES.indexOf(section.fontFamily.trim()) !== -1) normalizedSection.fontFamily = section.fontFamily.trim();
      var fontSize = numberInRange(section.fontSizePt, 8, 24);
      if (fontSize !== undefined) normalizedSection.fontSizePt = fontSize;
      var color = normalizeColor(section.color);
      if (color !== undefined) normalizedSection.color = color;
      if (sectionName === "title" && typeof section.underline === "boolean") normalizedSection.underline = section.underline;
      if ((sectionName === "groupHeader" || sectionName === "fieldHeader") && typeof section.bold === "boolean") normalizedSection.bold = section.bold;
      if (sectionName === "groupHeader" || sectionName === "fieldHeader" || sectionName === "body" || sectionName === "total") {
        var rowHeight = numberInRange(section.rowHeightPx, 16, 48);
        if (rowHeight !== undefined) normalizedSection.rowHeightPx = rowHeight;
      }
      if (sectionName === "signature") {
        var height = numberInRange(section.heightMm, 0, 20);
        if (height !== undefined) normalizedSection.heightMm = height;
      }
      if (Object.keys(normalizedSection).length) patch[sectionName] = normalizedSection;
    });

    var border = input.border;
    if (isPlainObject(border)) {
      var normalizedBorder = {};
      var borderColor = normalizeColor(border.color);
      if (borderColor !== undefined) normalizedBorder.color = borderColor;
      if (border.widthPx === 1) normalizedBorder.widthPx = 1;
      if (border.style === "solid") normalizedBorder.style = "solid";
      if (Object.keys(normalizedBorder).length) patch.border = normalizedBorder;
    }

    if (isPlainObject(input.columnWidthsByKey)) {
      var widths = {};
      Object.keys(input.columnWidthsByKey).forEach(function (key) {
        var width = input.columnWidthsByKey[key];
        if (typeof width === "number" && Number.isFinite(width)) widths[key] = width;
      });
      patch.columnWidthsByKey = widths;
    }
    return patch;
  }

  function overlay(target, patch) {
    Object.keys(patch).forEach(function (key) {
      if (key === "columnWidthsByKey") target[key] = Object.assign({}, patch[key]);
      else target[key] = Object.assign({}, target[key], patch[key]);
    });
    return target;
  }

  function normalizeLayout(source) {
    return overlay(createDefaultLayout(), normalizePatch(source));
  }

  function mergeEffectiveLayout(globalLayout, groupLayout) {
    return overlay(overlay(createDefaultLayout(), normalizePatch(globalLayout)), normalizePatch(groupLayout));
  }

  function applyColumnWidths(columns, layout) {
    var sourceColumns = Array.isArray(columns) ? columns : [];
    var widths = isPlainObject(layout) && isPlainObject(layout.columnWidthsByKey) ? layout.columnWidthsByKey : {};
    var currentKeys = Object.create(null);
    var addedKeys = [];
    var resultColumns = sourceColumns.map(function (column) {
      var copy = Object.assign({}, column);
      var key = copy.key;
      if (typeof key !== "string" || !key) return copy;
      currentKeys[key] = true;
      var minWidth = typeof copy.minWidthMm === "number" && Number.isFinite(copy.minWidthMm) ? copy.minWidthMm : copy.widthMm;
      minWidth = typeof minWidth === "number" && Number.isFinite(minWidth) ? clamp(minWidth, 0, 80) : 0;
      if (!hasOwn(widths, key)) addedKeys.push(key);
      var requested = hasOwn(widths, key) && typeof widths[key] === "number" && Number.isFinite(widths[key]) ? widths[key] : minWidth;
      copy.widthMm = clamp(requested, minWidth, 80);
      return copy;
    });
    var ignoredKeys = Object.keys(widths).filter(function (key) { return !hasOwn(currentKeys, key); });
    return { columns: resultColumns, addedKeys: addedKeys, ignoredKeys: ignoredKeys };
  }

  function selectPreviewRows(rows, limit) {
    var sourceRows = Array.isArray(rows) ? rows : [];
    var requestedLimit = typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : 30;
    var maximum = clamp(requestedLimit, 1, 30);
    if (sourceRows.length <= maximum) return sourceRows.slice();
    if (maximum === 1) return [sourceRows[0]];
    var sample = [];
    for (var index = 0; index < maximum; index += 1) {
      sample.push(sourceRows[Math.round(index * (sourceRows.length - 1) / (maximum - 1))]);
    }
    return sample;
  }

  function toLayoutCssVariables(source) {
    var layout = normalizeLayout(source);
    return [
      "--salary-paper:" + layout.page.paper,
      "--salary-page-margin:" + layout.page.marginMm + "mm",
      "--salary-title-font-family:" + layout.title.fontFamily,
      "--salary-title-size:" + layout.title.fontSizePt + "pt",
      "--salary-title-color:" + layout.title.color,
      "--salary-title-underline:" + (layout.title.underline ? "underline" : "none"),
      "--salary-group-header-font-family:" + layout.groupHeader.fontFamily,
      "--salary-group-header-size:" + layout.groupHeader.fontSizePt + "pt",
      "--salary-group-header-color:" + layout.groupHeader.color,
      "--salary-group-header-weight:" + (layout.groupHeader.bold ? "bold" : "normal"),
      "--salary-group-header-row-height:" + layout.groupHeader.rowHeightPx + "px",
      "--salary-field-header-font-family:" + layout.fieldHeader.fontFamily,
      "--salary-field-header-size:" + layout.fieldHeader.fontSizePt + "pt",
      "--salary-field-header-color:" + layout.fieldHeader.color,
      "--salary-field-header-weight:" + (layout.fieldHeader.bold ? "bold" : "normal"),
      "--salary-field-header-row-height:" + layout.fieldHeader.rowHeightPx + "px",
      "--salary-body-font-family:" + layout.body.fontFamily,
      "--salary-body-size:" + layout.body.fontSizePt + "pt",
      "--salary-body-color:" + layout.body.color,
      "--salary-body-row-height:" + layout.body.rowHeightPx + "px",
      "--salary-total-font-family:" + layout.total.fontFamily,
      "--salary-total-size:" + layout.total.fontSizePt + "pt",
      "--salary-total-color:" + layout.total.color,
      "--salary-total-row-height:" + layout.total.rowHeightPx + "px",
      "--salary-border-color:" + layout.border.color,
      "--salary-border-width:" + layout.border.widthPx + "px",
      "--salary-border-style:" + layout.border.style,
      "--salary-signature-font-family:" + layout.signature.fontFamily,
      "--salary-signature-size:" + layout.signature.fontSizePt + "pt",
      "--salary-signature-color:" + layout.signature.color,
      "--salary-signature-height:" + layout.signature.heightMm + "mm"
    ].join(";");
  }

  function toPersistedPayload(source, scope) {
    var payload = normalizeLayout(source);
    if (scope === "personal_default") delete payload.columnWidthsByKey;
    return payload;
  }

  function fromPersistedPayload(payload) {
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (error) {
        payload = {};
      }
    }
    return normalizeLayout(payload);
  }

  return {
    createDefaultLayout: createDefaultLayout,
    normalizeLayout: normalizeLayout,
    mergeEffectiveLayout: mergeEffectiveLayout,
    applyColumnWidths: applyColumnWidths,
    selectPreviewRows: selectPreviewRows,
    toLayoutCssVariables: toLayoutCssVariables,
    toPersistedPayload: toPersistedPayload,
    fromPersistedPayload: fromPersistedPayload
  };
});
