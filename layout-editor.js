(function (root, factory) {
  var api = factory(function () {
    var layoutConfig = root.SalaryPrintLayoutConfig;
    if (typeof module === "object" && module.exports) layoutConfig = layoutConfig || require("./layout-config");
    return { layoutConfig: layoutConfig };
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintLayoutEditor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (getDependencies) {
  var MAX_HISTORY = 30;
  var EDITABLE_PATHS = {
    "page.paper": true,
    "page.marginMm": true,
    "title.fontFamily": true,
    "title.fontSizePt": true,
    "title.color": true,
    "title.underline": true,
    "groupHeader.fontFamily": true,
    "groupHeader.fontSizePt": true,
    "groupHeader.color": true,
    "groupHeader.bold": true,
    "groupHeader.rowHeightPx": true,
    "fieldHeader.fontFamily": true,
    "fieldHeader.fontSizePt": true,
    "fieldHeader.color": true,
    "fieldHeader.bold": true,
    "fieldHeader.rowHeightPx": true,
    "body.fontFamily": true,
    "body.fontSizePt": true,
    "body.color": true,
    "body.rowHeightPx": true,
    "total.fontFamily": true,
    "total.fontSizePt": true,
    "total.color": true,
    "total.rowHeightPx": true,
    "signature.fontFamily": true,
    "signature.fontSizePt": true,
    "signature.color": true,
    "signature.heightMm": true,
    "border.color": true
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function createDraftController(options) {
    var layoutConfig = getDependencies().layoutConfig;
    if (!layoutConfig) throw new Error("版式配置依赖未加载");
    var initial = clone(layoutConfig.normalizeLayout(options && options.layout));
    var history = [clone(initial)];
    var cursor = 0;

    function current() {
      return history[cursor];
    }

    function record(next) {
      if (same(current(), next)) return false;
      history = history.slice(0, cursor + 1);
      history.push(clone(next));
      if (history.length > MAX_HISTORY) history.shift();
      cursor = history.length - 1;
      return true;
    }

    function normalizedWith(path, value) {
      var next = clone(current());
      var names = path.split(".");
      next[names[0]][names[1]] = value;
      return layoutConfig.normalizeLayout(next);
    }

    function patch(path, value) {
      if (!EDITABLE_PATHS[path]) return false;
      return record(normalizedWith(path, value));
    }

    function replaceWidth(key, width) {
      if (typeof key !== "string" || !key.trim() || key === "__proto__" || key === "constructor" || key === "prototype") return false;
      if (typeof width !== "number" || !Number.isFinite(width)) return false;
      var next = clone(current());
      next.columnWidthsByKey[key] = Math.max(0, Math.min(80, width));
      return record(layoutConfig.normalizeLayout(next));
    }

    function undo() {
      if (cursor === 0) return false;
      cursor -= 1;
      return true;
    }

    function redo() {
      if (cursor >= history.length - 1) return false;
      cursor += 1;
      return true;
    }

    function discard() {
      if (same(current(), initial)) return false;
      history = [clone(initial)];
      cursor = 0;
      return true;
    }

    function isDirty() {
      return !same(current(), initial);
    }

    return {
      patch: patch,
      replaceWidth: replaceWidth,
      undo: undo,
      redo: redo,
      discard: discard,
      isDirty: isDirty,
      getDraft: function () { return clone(current()); },
      getHistoryLength: function () { return history.length; }
    };
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function isOpenerAvailable(config, ownerWindow) {
    try {
      if (typeof config.isOpenerAvailable === "function") return config.isOpenerAvailable() === true;
      var opener = config.opener || ownerWindow;
      return !!opener && opener.closed !== true;
    } catch (error) {
      return false;
    }
  }

  function option(value, label, selected) {
    return '<option value="' + escapeHtml(value) + '"' + (selected ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
  }

  function fontControls(section, value, extras) {
    var common = '<label>字体<select name="' + section + '.fontFamily">' + option("SimSun", "宋体", value.fontFamily === "SimSun") + option("Arial", "Arial", value.fontFamily === "Arial") + '</select></label><label>字号<input name="' + section + '.fontSizePt" type="number" min="8" max="24" value="' + value.fontSizePt + '"></label><label>颜色<input name="' + section + '.color" type="color" value="' + value.color + '"></label>';
    return '<section class="inspector-section"><h2>' + escapeHtml(extras.title) + '</h2>' + common + (extras.rowHeight ? '<label>行高<input name="' + section + '.rowHeightPx" type="number" min="16" max="48" value="' + value.rowHeightPx + '"></label>' : "") + (extras.height ? '<label>高度<input name="' + section + '.heightMm" type="number" min="0" max="20" value="' + value.heightMm + '"></label>' : "") + (extras.boolean ? '<label class="check"><input name="' + section + '.' + extras.boolean + '" type="checkbox"' + (value[extras.boolean] ? " checked" : "") + ">" + escapeHtml(extras.booleanLabel) + "</label>" : "") + "</section>";
  }

  function buildInspector(layout, columns, scope) {
    var page = '<section class="inspector-section"><h2>页面</h2><label>纸张<select name="page.paper">' + option("A3 landscape", "A3 横向", layout.page.paper === "A3 landscape") + option("A4 landscape", "A4 横向", layout.page.paper === "A4 landscape") + option("B4 landscape", "B4 横向", layout.page.paper === "B4 landscape") + option("A4 portrait", "A4 纵向", layout.page.paper === "A4 portrait") + '</select></label><label>页边距<input name="page.marginMm" type="number" min="0" max="20" value="' + layout.page.marginMm + '"></label></section>';
    var widths = scope === "salary_group" ? columns.map(function (column) {
      var key = typeof column.key === "string" ? column.key : "";
      if (!key) return "";
      var base = Number(column.widthMm);
      var width = Object.prototype.hasOwnProperty.call(layout.columnWidthsByKey, key) ? layout.columnWidthsByKey[key] : (Number.isFinite(base) ? base : 20);
      return '<label class="width-control"><span>' + escapeHtml(column.name || column.label || key) + '</span><input data-width-key="' + escapeHtml(key) + '" type="range" min="0" max="80" value="' + width + '"><output>' + width + 'mm</output></label>';
    }).join("") : "";
    var widthInspector = scope === "salary_group" ? '<section class="inspector-section width-inspector"><h2>列宽（仅当前薪资组）</h2>' + widths + "</section>" : '<section class="inspector-section width-inspector"><h2>列宽</h2><p>个人默认不保存或预览列宽，请在当前薪资组中调整。</p></section>';
    return page + fontControls("title", layout.title, { title: "标题", boolean: "underline", booleanLabel: "下划线" }) + fontControls("groupHeader", layout.groupHeader, { title: "分组表头", rowHeight: true, boolean: "bold", booleanLabel: "加粗" }) + fontControls("fieldHeader", layout.fieldHeader, { title: "字段表头", rowHeight: true, boolean: "bold", booleanLabel: "加粗" }) + fontControls("body", layout.body, { title: "明细行", rowHeight: true }) + fontControls("total", layout.total, { title: "合计行", rowHeight: true }) + fontControls("signature", layout.signature, { title: "签署区", height: true }) + '<section class="inspector-section"><h2>边框</h2><label>颜色<input name="border.color" type="color" value="' + layout.border.color + '"></label><p>边框固定为 1px 实线。</p></section>' + widthInspector;
  }

  function buildPreview(rows, columns, layout) {
    var previewRows = getDependencies().layoutConfig.selectPreviewRows(rows, 30);
    var widths = layout && layout.columnWidthsByKey ? layout.columnWidthsByKey : {};
    var groups = [];
    columns.forEach(function (column) {
      var label = column.group || column.firstGroup || column.categoryName || "工资明细";
      var previous = groups[groups.length - 1];
      if (previous && previous.label === label) previous.count += 1;
      else groups.push({ label: label, count: 1 });
    });
    var colgroup = columns.map(function (column) {
      var width = widths[column.key];
      var style = typeof width === "number" && Number.isFinite(width) ? ' style="width:' + width + 'mm"' : "";
      return '<col data-preview-key="' + escapeHtml(column.key) + '"' + style + ">";
    }).join("");
    var groupHeaders = groups.map(function (group) { return '<th colspan="' + group.count + '">' + escapeHtml(group.label) + "</th>"; }).join("");
    var headers = columns.map(function (column) { return '<th data-preview-key="' + escapeHtml(column.key) + '">' + escapeHtml(column.name || column.label || column.key) + "</th>"; }).join("");
    var body = previewRows.map(function (row) {
      return "<tr>" + columns.map(function (column) { return "<td>" + escapeHtml(row && row[column.key]) + "</td>"; }).join("") + "</tr>";
    }).join("");
    var total = columns.length ? '<tr><td colspan="' + columns.length + '">合计（只读预览）</td></tr>' : "";
    return '<table aria-label="只读工资表预览"><colgroup>' + colgroup + '</colgroup><thead><tr class="group-header">' + groupHeaders + '</tr><tr class="field-header">' + headers + "</tr></thead><tbody>" + body + "</tbody><tfoot>" + total + '</tfoot></table><footer class="signature">制表：________________　审核：________________　签署：________________</footer>';
  }

  function editorShell(scope) {
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>工资表版式编辑器</title><style>@media screen{body{margin:0;background:#f2f0e9;color:#202522;font:14px Georgia,"Songti SC",serif}.layout-editor{min-height:100vh;display:grid;grid-template-rows:auto auto 1fr}.layout-editor-toolbar{position:sticky;top:0;z-index:4;display:flex;gap:8px;align-items:center;padding:12px 18px;background:#20362f;color:#fff}.layout-editor-toolbar .spacer{flex:1}.layout-editor-toolbar button,.layout-editor-toolbar select{font:inherit;padding:7px 10px}.layout-editor-data-lock{padding:9px 18px;background:#ead9a9;border-bottom:1px solid #91782f;font-weight:bold}.layout-editor-workspace{display:grid;grid-template-columns:minmax(420px,1fr) 280px;min-height:0}.layout-editor-preview{padding:28px;overflow:auto;background:#d7d1c2}.layout-editor-preview-sheet{background:#fff;box-shadow:0 12px 35px #0003;padding:22px;min-height:420px}.layout-editor-preview table{width:100%;border-collapse:collapse}.layout-editor-preview th,.layout-editor-preview td{padding:8px;border:1px solid var(--salary-border-color,#000);text-align:center}.layout-editor-preview .group-header th{font-family:var(--salary-group-header-font-family);font-size:var(--salary-group-header-size);color:var(--salary-group-header-color);font-weight:var(--salary-group-header-weight);height:var(--salary-group-header-row-height)}.layout-editor-preview .field-header th{font-family:var(--salary-field-header-font-family);font-size:var(--salary-field-header-size);color:var(--salary-field-header-color);font-weight:var(--salary-field-header-weight);height:var(--salary-field-header-row-height)}.layout-editor-preview tbody{font-family:var(--salary-body-font-family);font-size:var(--salary-body-size);color:var(--salary-body-color)}.layout-editor-preview tbody tr{height:var(--salary-body-row-height)}.layout-editor-preview tfoot{font-family:var(--salary-total-font-family);font-size:var(--salary-total-size);color:var(--salary-total-color);height:var(--salary-total-row-height)}.layout-editor-preview .signature{min-height:var(--salary-signature-height);font-family:var(--salary-signature-font-family);font-size:var(--salary-signature-size);color:var(--salary-signature-color);padding-top:12px}.layout-editor-inspector{width:280px;padding:14px;overflow:auto;background:#fdfbf5;border-left:1px solid #c9c1b1}.inspector-section{border-bottom:1px solid #ded6c6;padding:10px 0}.inspector-section h2{font-size:14px;margin:0 0 8px}.layout-editor-inspector label{display:block;margin:6px 0}.layout-editor-inspector input,.layout-editor-inspector select{float:right;max-width:150px}.layout-editor-inspector .check input{float:none}.width-control{display:grid!important;grid-template-columns:1fr 130px 45px;gap:6px;align-items:center}.width-control input{float:none!important;width:100%}.width-control input[type=range]::-webkit-slider-thumb{width:8px;height:18px}.width-control input[type=range]::-moz-range-thumb{width:8px;height:18px;border:0;border-radius:0}.warning{display:none;margin:8px 18px;color:#9d1717}.warning.visible{display:block}.layout-editor :focus-visible{outline:3px solid #b79758;outline-offset:2px}}@media(prefers-reduced-motion:reduce){.layout-editor *{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}@media(max-width:960px){.layout-editor-toolbar{position:static;flex-wrap:wrap}.layout-editor-workspace{grid-template-columns:1fr}.layout-editor-inspector{width:auto;border-top:1px solid #c9c1b1;border-left:0}.layout-editor-preview{padding:16px}}@media print{.layout-editor-toolbar,.layout-editor-data-lock,.layout-editor-inspector{display:none}.warning{display:none}.layout-editor-workspace{display:block}.layout-editor-preview{padding:0;background:#fff}.layout-editor-preview-sheet{box-shadow:none;padding:0}}</style></head><body aria-readonly="true"><main class="layout-editor" aria-readonly="true"><nav class="layout-editor-toolbar" aria-label="版式操作"><button id="undo" type="button">撤销</button><button id="redo" type="button">重做</button><button id="reset" type="button">重置</button><span class="spacer"></span><label>保存范围<select id="scope">' + option("salary_group", "当前薪资组", scope === "salary_group") + option("personal_default", "个人默认", scope === "personal_default") + '</select></label><button id="cancel" type="button">取消</button><button id="save" type="button">保存并返回</button><button id="directPrint" type="button">直接打印</button></nav><div class="layout-editor-data-lock">数据锁定：仅可调整纸张、字体、行高、边框、签署区与列宽；工资数据和字段结构均为只读。</div><p id="sourceWarning" class="warning"></p><p id="saveError" class="warning" role="alert"></p><section class="layout-editor-workspace"><section class="layout-editor-preview"><article id="previewSheet" class="layout-editor-preview-sheet"></article></section><aside id="inspector" class="layout-editor-inspector" aria-label="版式检查器"></aside></section></main></body></html>';
  }

  function openLayoutEditor(options) {
    var config = options || {};
    var ownerWindow = config.window || (typeof window !== "undefined" ? window : null);
    if (!ownerWindow || typeof ownerWindow.open !== "function") {
      if (typeof config.onBlocked === "function") config.onBlocked();
      return null;
    }
    var popup = ownerWindow.open("", "salary-print-layout-editor", "popup=yes,width=1440,height=920");
    if (!popup) {
      if (typeof config.onBlocked === "function") config.onBlocked();
      return null;
    }
    var document;
    var initialScope = config.scope === "personal_default" ? "personal_default" : "salary_group";
    try {
      document = popup.document;
      if (!document) throw new Error("无法访问版式编辑器窗口");
      document.open();
      document.write(editorShell(initialScope));
      document.close();
    } catch (error) {
      if (typeof config.onError === "function") config.onError(error);
      else if (typeof config.onBlocked === "function") config.onBlocked();
      return null;
    }

    var controller = createDraftController({ layout: config.layout });
    var rows = Array.isArray(config.rows) ? config.rows.slice() : [];
    var columns = Array.isArray(config.columns) ? config.columns.map(function (column) { return Object.assign({}, column); }) : [];
    var pendingWidths = Object.create(null);
    var frameScheduled = false;
    var saveInFlight = false;
    var printInFlight = false;
    var sourceWarning = document.getElementById("sourceWarning");
    var saveError = document.getElementById("saveError");
    var saveButton = document.getElementById("save");
    var printButton = document.getElementById("directPrint");
    var scopeControl = document.getElementById("scope");
    var activeScope = initialScope;
    scopeControl.value = initialScope;

    function currentScope() {
      return activeScope;
    }

    function isBusy() {
      return saveInFlight || printInFlight;
    }

    function setDraftControlsDisabled(disabled) {
      ["undo", "redo", "reset", "cancel", "scope"].forEach(function (id) {
        document.getElementById(id).disabled = disabled;
      });
      Array.prototype.forEach.call(document.getElementById("inspector").querySelectorAll("input, select, button"), function (control) {
        control.disabled = disabled;
      });
    }

    function clearSaveError() {
      saveError.textContent = "";
      saveError.className = "warning";
    }

    function showSaveError(error) {
      var message = error && error.message ? error.message : "未知错误";
      saveError.textContent = "保存失败：" + message;
      saveError.className = "warning visible";
    }

    function sourceIsLive() {
      var available = isOpenerAvailable(config, ownerWindow);
      sourceWarning.textContent = available ? "" : "源工资表已失效，请返回后重新打开版式编辑器。";
      sourceWarning.className = available ? "warning" : "warning visible";
      saveButton.disabled = !available || isBusy();
      printButton.disabled = !available || isBusy();
      setDraftControlsDisabled(isBusy());
      return available;
    }

    function render() {
      var draft = controller.getDraft();
      var scope = currentScope();
      var previewLayout = scope === "personal_default" ? getDependencies().layoutConfig.toPersistedPayload(draft, scope) : draft;
      var sheet = document.getElementById("previewSheet");
      sheet.style.cssText = getDependencies().layoutConfig.toLayoutCssVariables(previewLayout);
      sheet.innerHTML = '<h1 style="font-family:var(--salary-title-font-family);font-size:var(--salary-title-size);color:var(--salary-title-color);text-decoration:var(--salary-title-underline)">工资表版式预览</h1>' + buildPreview(rows, columns, previewLayout);
      document.getElementById("inspector").innerHTML = buildInspector(draft, columns, scope);
      bindInspector();
      sourceIsLive();
    }

    function readControl(control) {
      if (control.type === "checkbox") return control.checked;
      if (control.type === "number") return Number(control.value);
      return control.value;
    }

    function updatePreviewWidth(key, width) {
      var sheet = document.getElementById("previewSheet");
      Array.prototype.forEach.call(sheet.querySelectorAll("[data-preview-key]"), function (cell) {
        if (cell.getAttribute("data-preview-key") === key) cell.style.width = width + "mm";
      });
    }

    function bindInspector() {
      var inspector = document.getElementById("inspector");
      Array.prototype.forEach.call(inspector.querySelectorAll("input[name], select[name]"), function (control) {
          control.addEventListener("change", function () {
            if (isBusy()) return;
            controller.patch(control.name, readControl(control));
            render();
        });
      });
      Array.prototype.forEach.call(inspector.querySelectorAll("[data-width-key]"), function (control) {
          var commit = function () {
            if (isBusy()) return;
            var key = control.getAttribute("data-width-key");
          if (Object.prototype.hasOwnProperty.call(pendingWidths, key)) {
            controller.replaceWidth(key, pendingWidths[key]);
            delete pendingWidths[key];
            render();
          }
        };
        control.addEventListener("pointerdown", function (event) { if (!isBusy() && control.setPointerCapture && event.pointerId !== undefined) control.setPointerCapture(event.pointerId); });
        control.addEventListener("input", function () {
          if (isBusy()) return;
          pendingWidths[control.getAttribute("data-width-key")] = Number(control.value);
          if (!frameScheduled) {
            frameScheduled = true;
            var update = function () {
                frameScheduled = false;
                var output = control.parentNode.querySelector("output");
                if (output) output.textContent = control.value + "mm";
                updatePreviewWidth(control.getAttribute("data-width-key"), Number(control.value));
            };
            (popup.requestAnimationFrame || function (callback) { return callback(); })(update);
          }
        });
        control.addEventListener("pointerup", commit);
        control.addEventListener("change", commit);
      });
    }

    document.getElementById("undo").addEventListener("click", function () { if (!isBusy()) { controller.undo(); render(); } });
    document.getElementById("redo").addEventListener("click", function () { if (!isBusy()) { controller.redo(); render(); } });
    document.getElementById("reset").addEventListener("click", function () { if (!isBusy()) { controller.discard(); render(); } });
    document.getElementById("cancel").addEventListener("click", function () { if (!isBusy()) popup.close(); });
    scopeControl.addEventListener("change", function () {
      if (isBusy()) {
        scopeControl.value = activeScope;
        return;
      }
      activeScope = scopeControl.value === "personal_default" ? "personal_default" : "salary_group";
      render();
    });
    saveButton.addEventListener("click", function () {
      if (isBusy() || !sourceIsLive()) return;
      saveInFlight = true;
      clearSaveError();
      sourceIsLive();
      var scope = currentScope();
      var payload = getDependencies().layoutConfig.toPersistedPayload(controller.getDraft(), scope);
      Promise.resolve().then(function () {
        if (typeof config.onSave === "function") return config.onSave(payload, scope);
      }).then(function () {
        controller.discard();
        popup.close();
      }).catch(function (error) {
        saveInFlight = false;
        showSaveError(error);
        sourceIsLive();
      });
    });
    printButton.addEventListener("click", function () {
      if (isBusy() || !sourceIsLive()) return;
      printInFlight = true;
      clearSaveError();
      sourceIsLive();
      var operation;
      try {
        operation = typeof config.onPrint === "function" ? config.onPrint(controller.getDraft()) : undefined;
      } catch (error) {
        printInFlight = false;
        showSaveError(error);
        sourceIsLive();
        return;
      }
      Promise.resolve(operation).then(function () {
        printInFlight = false;
        sourceIsLive();
      }).catch(function (error) {
        printInFlight = false;
        showSaveError(error);
        sourceIsLive();
      });
    });
    popup.addEventListener("beforeunload", function (event) {
      if (!controller.isDirty()) return;
      event.preventDefault();
      event.returnValue = "版式修改尚未保存。";
    });
    render();
    return popup;
  }

  return { createDraftController: createDraftController, openLayoutEditor: openLayoutEditor };
});
