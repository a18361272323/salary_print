(function waitForDependencies(attempt) {
  var dependencies = ["SalaryPrintWorkspaceTemplate", "SalaryPrintMonthPicker", "SalaryPrintDataLoader", "SalaryPrintLayout", "SalaryPrintWorkflow", "SalaryPrintRenderer", "SalaryPrintDocument", "SalaryPrintModelMethodClient", "SalaryPrintRuntimeContext", "SalaryPrintColumnPreferenceStore", "SalaryPrintLayoutConfig", "SalaryPrintLayoutEditor", "SalaryPrintLayoutProfileStore", "SalaryPrintRequestEnvironment", "SalaryPrintCryptoRuntime", "SalaryPrintSortable", "SalaryPrintAppSession"];
  var missing = dependencies.filter(function (name) { return !window[name]; });
  if (missing.length) {
    if (attempt >= 200) { console.error("工资表资源加载失败：" + missing.join(", ")); return; }
    setTimeout(function () { waitForDependencies(attempt + 1); }, 25);
    return;
  }

  (function () {
    SalaryPrintWorkspaceTemplate.mount(document);
    var endpoints = { groups: "/xft-gateway/xft-sly/xwapi/salary-calculate/salary-group/sort-query", headers: "/xft-gateway/xft-sly/xwapi/salary-calculate/current-salary/item-header", page: "/xft-gateway/xft-sly/xwapi/salary-query/data-page", key: "/xft-gateway/xft-login-new/xwapi/gateway/security-key/generate" };
    var publicKey = "BGMptcE9RGTbVT6NbGLx04ZucPEaRoIOJFM+IrxrwoOdudO7QHgaIX9xq/YcxqWOGGN3WXcvpzoNSZ7ItgerhYU=";
    var state = { session: null, groups: [], headers: [], columns: [], rows: [], cancelled: false, document: null, sequence: 0, monthKey: null, monthView: null, preferenceStore: null, preferenceRecords: [], layoutStore: null, layoutRecords: { global: null, group: null }, layout: null, sortables: [], queryGuard: SalaryPrintAppSession.createQueryGuard(), queryInFlight: false };

    function $(id) { return document.getElementById(id); }
    function setStatus(value, error) { $("status").textContent = value; $("status").style.color = error ? "#a83b32" : ""; }
    function b64bytes(value) { return Array.from(Uint8Array.from(atob(value), function (c) { return c.charCodeAt(0); })); }
    function bytes64(value) { return btoa(String.fromCharCode.apply(null, value)); }
    function bytes(value) { return Array.from(new TextEncoder().encode(value)); }
    function text(value) { return new TextDecoder().decode(new Uint8Array(value)); }
    function result(operation, key) { if (!operation || operation.errorCode !== 0) throw new Error(operation && operation.errorMsg || "加密运行时失败"); return operation[key]; }
    function usesEncryption() { var tag = ""; try { tag = window.parent && window.parent.window && window.parent.window.envTag || window.parent && window.parent.envTag || ""; } catch (_) {} return SalaryPrintRequestEnvironment.shouldEncryptRequests(tag); }

    async function initialize() {
      if (state.session) return state.session;
      if (!usesEncryption()) { state.session = { plain: true }; return state.session; }
      var cryptoApi = await SalaryPrintCryptoRuntime.ensureCryptoRuntime();
      var requestTime = Date.now();
      var randomKey = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      var bootstrap = bytes64(result(cryptoApi.CMBSM2Encrypt(b64bytes(publicKey), bytes(JSON.stringify({ randomKey: bytes64(randomKey), timestamp: requestTime }))), "result"));
      var response = await fetch(endpoints.key, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: bootstrap }) });
      var envelope = await response.json();
      if (envelope.returnCode !== "SUC0000") throw new Error(envelope.errorMsg || "安全密钥协商失败");
      var keys = JSON.parse(text(result(cryptoApi.CMBSM4DecryptWithCTR(randomKey, b64bytes(envelope.body.data)), "result")));
      state.session = { enc: b64bytes(keys.enckey), sign: b64bytes(keys.sgnkey), version: keys.version, offset: Number(keys.serverTime) - requestTime, crypto: cryptoApi };
      return state.session;
    }

    async function post(path, payload, menuCode) {
      var session = await initialize();
      var menu = menuCode || "SAL14000";
      if (session.plain) {
        var plainResponse = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "xft-menu-code": menu }, body: JSON.stringify(payload) });
        var plainEnvelope = await plainResponse.json();
        if (plainEnvelope.returnCode !== "SUC0000") throw new Error(plainEnvelope.errorMsg || "工资接口返回失败");
        return plainEnvelope.body;
      }
      var cryptoApi = session.crypto;
      var encryptedBody = bytes64(result(cryptoApi.CMBSM4EncryptWithCTR(session.enc, bytes(JSON.stringify(payload))), "result"));
      var timestamp = String(Date.now() + session.offset);
      var nonce = Date.now() + "_" + Math.random().toString(36).slice(2) + "_" + String(state.sequence++ % 10000).padStart(4, "0");
      var sign = bytes64(result(cryptoApi.CMBSM2SignWithSM3(session.sign, bytes(nonce + timestamp + encryptedBody + session.version)), "sign"));
      var response = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "xft-menu-code": menu, "x-xft-request-encrypted": "true", "x-xft-nonce": nonce, "x-xft-timestamp": timestamp, "x-xft-key-version": session.version }, body: JSON.stringify({ encryptedBody: encryptedBody, sign: sign }) });
      var envelope = await response.json();
      if (envelope.returnCode !== "SUC0000") throw new Error(envelope.errorMsg || "工资接口返回失败");
      return envelope.body;
    }

    function escapeHtml(value) { return String(value === undefined || value === null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }
    function destroySortables() { state.sortables.forEach(function (sortable) { sortable.destroy(); }); state.sortables = []; }
    function syncDragOrder() { var keys = []; $("columnEditor").querySelectorAll(".column-group-items .column-item").forEach(function (item) { keys.push(item.dataset.key); }); state.columns = SalaryPrintLogic.orderColumnsByKeys(state.columns, keys); setStatus("字段顺序已调整，请保存列配置。"); renderColumns(); prepare(); }
    function initializeDragSorting() {
      var editor = $("columnEditor");
      var Sortable = window.SalaryPrintSortable;
      if (!Sortable) return;
      state.sortables.push(new Sortable(editor, { animation: 150, draggable: ".column-group", handle: ".group-drag", onEnd: syncDragOrder }));
      editor.querySelectorAll(".column-group-items").forEach(function (list, index) { state.sortables.push(new Sortable(list, { group: { name: "salary-print-columns-" + index, pull: false, put: false }, animation: 150, draggable: ".column-item", handle: ".column-drag", onEnd: syncDragOrder })); });
    }
    function renderColumns() {
      var groups = SalaryPrintLogic.groupColumnsByTopGroup(state.columns);
      var editor = $("columnEditor");
      destroySortables();
      editor.innerHTML = groups.map(function (group) {
        return '<section class="column-group" data-group="' + escapeHtml(group.label) + '"><div class="column-group-head"><span><small>一级表头</small><b>' + escapeHtml(group.label) + '</b></span><span class="sort-actions"><button type="button" class="drag-handle group-drag" title="拖拽排序一级表头">&#8942;&#8942;</button><button type="button" class="group-move" data-group="' + escapeHtml(group.label) + '" data-direction="-1" title="一级表头上移">&#8593;</button><button type="button" class="group-move" data-group="' + escapeHtml(group.label) + '" data-direction="1" title="一级表头下移">&#8595;</button></span></div><div class="column-group-items">' + group.columns.map(function (column) {
          var secondGroup = column.secondGroup || column.label;
          var fieldLabel = secondGroup === column.label ? "" : "<em>字段：" + escapeHtml(column.label) + "</em>";
          return '<div class="column-item" data-key="' + escapeHtml(column.key) + '"><label class="column-toggle"><input type="checkbox" data-key="' + escapeHtml(column.key) + '" ' + (column.printFlag ? "checked" : "") + '><span><small>二级表头</small><b>' + escapeHtml(secondGroup) + "</b>" + fieldLabel + '</span></label><span class="sort-actions"><button type="button" class="drag-handle column-drag" title="拖拽排序二级表头">&#8942;&#8942;</button><button type="button" class="column-move" data-key="' + escapeHtml(column.key) + '" data-direction="-1" title="二级表头上移">&#8593;</button><button type="button" class="column-move" data-key="' + escapeHtml(column.key) + '" data-direction="1" title="二级表头下移">&#8595;</button></span></div>';
        }).join("") + "</div></section>";
      }).join("");
      editor.querySelectorAll("input").forEach(function (input) { input.onchange = function () { state.columns.find(function (column) { return column.key === input.dataset.key; }).printFlag = input.checked; prepare(); }; });
      editor.querySelectorAll(".group-move").forEach(function (button) { button.onclick = function () { state.columns = SalaryPrintLogic.moveGroup(state.columns, button.dataset.group, Number(button.dataset.direction)); renderColumns(); prepare(); }; });
      editor.querySelectorAll(".column-move").forEach(function (button) { button.onclick = function () { state.columns = SalaryPrintLogic.moveColumnWithinGroup(state.columns, button.dataset.key, Number(button.dataset.direction)); renderColumns(); prepare(); }; });
      initializeDragSorting();
    }

    function initializeProfileStores() {
      var config = window.SalaryPrintModelConfig || {};
      var methods = config.methods || {};
      if (!config.modelKey || !methods.list || !methods.create || !methods.update) return { preferenceStore: null, layoutStore: null };
      var runtime = SalaryPrintRuntimeContext.createRuntimeContext();
      var client = SalaryPrintModelMethodClient.createModelMethodClient({ baseUrl: runtime.baseUrl, modelKey: config.modelKey, methods: methods });
      var owner;
      function getOwnerUserNo() { owner = owner || runtime.getOwnerUserNo(); return owner; }
      return {
        preferenceStore: SalaryPrintColumnPreferenceStore.createColumnPreferenceStore({ client: client, getOwnerUserNo: getOwnerUserNo }),
        layoutStore: SalaryPrintLayoutProfileStore.createLayoutProfileStore({ client: client, getOwnerUserNo: getOwnerUserNo })
      };
    }

    function layoutForCurrentPaper() {
      var layout = SalaryPrintLayoutConfig.normalizeLayout(state.layout || {});
      var paper = $("paperSelect").value;
      if (paper) layout.page.paper = paper;
      return layout;
    }
    function defaultLayoutResult() { return { layout: SalaryPrintLayoutConfig.createDefaultLayout(), records: { global: null, group: null }, warnings: ["版式配置模型尚未注入，已使用默认版式"] }; }
    function setLayoutProfileStatus(layouts) {
      var messages = [];
      if (layouts.records && layouts.records.global) messages.push("已应用个人默认版式");
      if (layouts.records && layouts.records.group) messages.push("已叠加当前薪资组版式");
      if (layouts.warnings && layouts.warnings.length) messages.push(layouts.warnings[0]);
      $("layoutProfileStatus").textContent = messages.length ? messages.join("；") : "正在使用默认版式。";
    }
    async function reloadLayout(groupId) {
      var salaryGroupId = groupId === undefined ? $("groupSelect").value : groupId;
      var layouts = state.layoutStore ? await state.layoutStore.load({ salaryGroupId: salaryGroupId }) : defaultLayoutResult();
      state.layoutRecords = layouts.records;
      state.layout = layouts.layout;
      if (state.layout && state.layout.page && state.layout.page.paper) $("paperSelect").value = state.layout.page.paper;
      setLayoutProfileStatus(layouts);
      return layouts;
    }

    async function saveColumns() {
      if (state.queryInFlight) { setStatus("正在刷新工资表，请稍后保存列配置。", true); return; }
      if (!state.preferenceStore) { setStatus("列配置模型尚未注入，无法保存。", true); return; }
      if (!state.headers.length) { setStatus("请先生成工资表后再保存列配置。", true); return; }
      try {
        await state.preferenceStore.save({ salaryGroupId: $("groupSelect").value, salaryCycle: state.monthKey, columns: state.columns, records: state.preferenceRecords });
        var loaded = await state.preferenceStore.load({ salaryGroupId: $("groupSelect").value, salaryCycle: state.monthKey });
        state.preferenceRecords = loaded.records;
        setStatus("个人列配置已保存。");
      } catch (error) { setStatus(error.message || "保存列配置失败", true); }
    }

    function renderPages(printDocument) {
      var group = state.groups.find(function (item) { return item.salaryGroupId === $("groupSelect").value; });
      var columns = printDocument.columns;
      var groupName = group ? group.salaryGroupName : "—";
      return SalaryPrintRenderer.renderPrintPages({ pages: printDocument.pages, columns: columns, totals: SalaryPrintLogic.calculateTotals(state.rows, columns), title: state.monthKey.slice(0, 4) + "年" + Number(state.monthKey.slice(4)) + "月" + groupName + "工资表", totalRows: state.rows.length, layout: printDocument.layout });
    }

    function render() {
      if (!state.document) return;
      $("printPages").innerHTML = renderPages(state.document);
      document.documentElement.style.setProperty("--print-size", state.document.fit.paper);
      document.documentElement.style.setProperty("--print-font", state.document.fit.fontPt + "pt");
      $("printSummary").textContent = "共 " + state.rows.length + " 条，预计 " + state.document.pages.length + " 页，" + state.document.fit.paper + "，字号 " + state.document.fit.fontPt + "pt。";
      $("printButton").disabled = false;
    }

    async function prepareDocument(layoutOverride) {
      if (!state.rows.length) return null;
      var layout = layoutOverride ? SalaryPrintLayoutConfig.normalizeLayout(layoutOverride) : layoutForCurrentPaper();
      var paper = layoutOverride ? layout.page.paper : $("paperSelect").value;
      return SalaryPrintWorkflow.preparePrintDocument({ paper: paper, columns: state.columns, layout: layout, loader: { loadPage: async function () { return { records: state.rows, total: state.rows.length }; } } });
    }

    async function prepare(layoutOverride, expectedQueryToken) {
      var result = await prepareDocument(layoutOverride);
      if (expectedQueryToken !== undefined && !state.queryGuard.isCurrent(expectedQueryToken)) return null;
      if (!result) return null;
      if (!result.canPrint) {
        $("printSummary").textContent = result.fit.status === "suggest-a3" ? "当前 A4 需低于 6.5pt；请切换 A3 横向或调整列。" : "当前 A3 仍超宽，请调整可选列。";
        $("printButton").disabled = true;
        return null;
      }
      state.document = result;
      state.document.pages.forEach(function (page) { page.rows.forEach(function (row) { row._sequence = state.rows.indexOf(row) + 1; }); });
      render();
      return result;
    }

    function editLayout() {
      if (state.queryInFlight || !state.rows.length || !state.headers.length || !state.layoutStore) { setStatus("请先生成工资表并确认版式配置模型可用。", true); return; }
      var snapshot = SalaryPrintAppSession.createSnapshot($("groupSelect").value, state.monthKey, state.queryGuard.current());
      function snapshotIsLive() { return !state.queryInFlight && SalaryPrintAppSession.matchesSnapshot(snapshot, $("groupSelect").value, state.monthKey, state.queryGuard.current()); }
      SalaryPrintLayoutEditor.openLayoutEditor({
        layout: layoutForCurrentPaper(),
        rows: state.rows,
        columns: state.columns,
        scope: "salary_group",
        isOpenerAvailable: function () { return state.rows.length > 0 && state.headers.length > 0 && snapshotIsLive(); },
        onBlocked: function () { setStatus("浏览器拦截了版式编辑窗口，请允许弹窗后重试。", true); },
        onError: function (error) { setStatus(error.message || "无法打开版式编辑器", true); },
        onSave: async function (layout, scope) {
          if (!snapshotIsLive()) throw new Error("源工资表已变更，请返回后重新打开版式编辑器。");
          await state.layoutStore.save({ scope: scope, salaryGroupId: snapshot.groupId, layout: layout, records: state.layoutRecords });
          if (!snapshotIsLive()) throw new Error("源工资表已变更，请返回后重新打开版式编辑器。");
          await reloadLayout(snapshot.groupId);
          if (!snapshotIsLive()) throw new Error("源工资表已变更，请返回后重新打开版式编辑器。");
          await prepare();
          setStatus("版式已保存并重新生成预览。");
        },
        onPrint: function (layout) {
          if (!snapshotIsLive()) return Promise.reject(new Error("源工资表已变更，请返回后重新打开版式编辑器。"));
          return SalaryPrintAppSession.runDirectPrint({
            openWindow: function () { return window.open("", "salary-print-document"); },
            prepare: function () { if (!snapshotIsLive()) return Promise.reject(new Error("源工资表已变更，请返回后重新打开版式编辑器。")); return prepareDocument(SalaryPrintLayoutConfig.normalizeLayout(layout)); },
            write: function (popup, prepared) { if (!snapshotIsLive()) throw new Error("源工资表已变更，请返回后重新打开版式编辑器。"); writePrintDocument(popup, prepared); }
          });
        }
      });
    }

    async function query() {
      var groupId = $("groupSelect").value;
      var cycle = state.monthKey;
      var queryToken = state.queryGuard.begin();
      state.queryInFlight = true;
      $("editLayout").disabled = true;
      try {
        state.cancelled = false;
        $("cancelLoadButton").hidden = false;
        $("progressBar").style.width = "0%";
        setStatus("正在读取实时表头和全部工资数据…");
        var response = await Promise.all([post(endpoints.headers, { salaryGroupId: groupId, batchNumber: "", queryType: "1", itemHeaderType: "other" }, "SAL20000"), state.preferenceStore ? state.preferenceStore.load({ salaryGroupId: groupId, salaryCycle: cycle }) : Promise.resolve({ records: [], preferences: [] }), state.layoutStore ? state.layoutStore.load({ salaryGroupId: groupId }) : Promise.resolve(defaultLayoutResult())]);
        if (!state.queryGuard.isCurrent(queryToken)) return;
        var headers = SalaryPrintLogic.flattenCategoryHeaders(response[0]);
        var preferences = response[1];
        var layouts = response[2];
        var loaded = await SalaryPrintDataLoader.loadAllSalaryRows({
          isCancelled: function () { return state.cancelled || !state.queryGuard.isCurrent(queryToken); },
          onProgress: function (progress) { if (!state.queryGuard.isCurrent(queryToken)) return; $("loadProgress").textContent = "已加载 " + progress.loaded + " / " + progress.total + " 条"; $("progressBar").style.width = (progress.total ? Math.min(100, progress.loaded / progress.total * 100) : 0) + "%"; },
          loadPage: async function (page) {
            var body = await post(endpoints.page, { current: page.current, size: page.size, records: [{ salaryGroupId: groupId, salaryPeriodBegin: cycle, salaryPeriodEnd: cycle, editFlag: true }] });
            var data = body.salaryDetailDataPages || body;
            return { records: data.records || [], total: data.total || data.totalCount || 0 };
          }
        });
        if (!state.queryGuard.isCurrent(queryToken)) return;
        state.headers = headers;
        state.preferenceRecords = preferences.records;
        state.layoutRecords = layouts.records; state.layout = layouts.layout;
        if (state.layout && state.layout.page && state.layout.page.paper) $("paperSelect").value = state.layout.page.paper;
        setLayoutProfileStatus(layouts);
        state.columns = SalaryPrintLogic.buildColumns(headers, preferences.preferences);
        state.rows = SalaryPrintLogic.normalizeRows(loaded.records, state.columns);
        renderColumns();
        await prepare(undefined, queryToken);
        if (!state.queryGuard.isCurrent(queryToken)) return;
        $("editLayout").disabled = false;
        setStatus("工资表已生成。");
      } catch (error) { if (state.queryGuard.isCurrent(queryToken)) setStatus(error.message || "查询失败", true); }
      finally { if (state.queryGuard.isCurrent(queryToken)) { state.queryInFlight = false; $("cancelLoadButton").hidden = true; } }
    }

    function renderMonthPicker() {
      var picker = SalaryPrintMonthPicker;
      var nowKey = picker.toMonthKey(new Date());
      var start = state.monthView.slice(0, 4) + "01";
      $("monthPickerTitle").textContent = start.slice(0, 4) + " 年";
      $("monthPickerButton").textContent = picker.formatMonthLabel(state.monthKey);
      $("monthGrid").innerHTML = Array.from({ length: 12 }, function (_, index) {
        var key = start.slice(0, 4) + String(index + 1).padStart(2, "0");
        var disabled = !picker.canSelectMonth(key, nowKey);
        return '<button type="button" data-month="' + key + '" ' + (disabled ? "disabled" : "") + ' class="' + (key === state.monthKey ? "selected" : "") + '">' + String(index + 1).padStart(2, "0") + "月</button>";
      }).join("");
      $("monthGrid").querySelectorAll("button").forEach(function (button) { button.onclick = function () { if (button.disabled) return; state.monthKey = button.dataset.month; $("monthPickerDialog").hidden = true; renderMonthPicker(); }; });
    }

    function writePrintDocument(popup, prepared) {
      var css = document.querySelector('link[rel="stylesheet"]');
      var fit = prepared;
      popup.opener = null;
      popup.document.open();
      popup.document.write(SalaryPrintDocument.createPrintDocument({ title: "工资表打印预览", cssHref: css && css.href, pagesHtml: renderPages(prepared), paper: fit.fit.paper, fontPt: fit.fit.fontPt, layout: fit.layout, layoutCssVariables: fit.layoutCssVariables, pageMarginMm: fit.pageMarginMm }));
      popup.document.close();
    }

    function printPreparedDocument(prepared) {
      var popup = window.open("", "salary-print-document");
      if (!popup) { setStatus("浏览器拦截了打印窗口，请允许弹窗后重试。", true); return; }
      writePrintDocument(popup, prepared);
    }

    function printOnlyPages() {
      if (!state.document) { setStatus("请先生成工资表后再打印。", true); return; }
      printPreparedDocument(state.document);
    }

    async function start() {
      state.monthKey = SalaryPrintMonthPicker.toMonthKey(new Date());
      state.monthView = state.monthKey;
      var stores = initializeProfileStores();
      state.preferenceStore = stores.preferenceStore; state.layoutStore = stores.layoutStore;
      renderMonthPicker();
      $("monthPickerButton").onclick = function () { $("monthPickerDialog").hidden = !$("monthPickerDialog").hidden; };
      $("monthPrevious").onclick = function () { state.monthView = SalaryPrintMonthPicker.shiftMonth(state.monthView, -12); renderMonthPicker(); };
      $("monthNext").onclick = function () { var next = SalaryPrintMonthPicker.shiftMonth(state.monthView, 12); var now = SalaryPrintMonthPicker.toMonthKey(new Date()); if (next <= now) { state.monthView = next; renderMonthPicker(); } };
      $("queryButton").onclick = query;
      $("cancelLoadButton").onclick = function () { state.cancelled = true; };
      $("paperSelect").onchange = prepare;
      $("printButton").onclick = printOnlyPages;
      $("editLayout").onclick = editLayout;
      var saveButton = $("saveColumns"); if (saveButton) saveButton.onclick = saveColumns;
      $("resetColumns").onclick = function () { state.columns = SalaryPrintLogic.buildColumns(state.headers, []); state.preferenceRecords = []; renderColumns(); prepare(); };
      try {
        state.groups = await post(endpoints.groups, { authorityCode: "SASALSHW" });
        $("groupSelect").innerHTML = state.groups.map(function (group) { return '<option value="' + group.salaryGroupId + '">' + group.salaryGroupName + "</option>"; }).join("");
        setStatus("请选择薪资组和所属期后查询。");
      } catch (error) { setStatus(error.message || "初始化失败", true); }
    }
    start();
  })();
})(0);
