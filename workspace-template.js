(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintWorkspaceTemplate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createWorkspaceMarkup() {
    return '<main class="shell"><header class="masthead"><div><span class="eyebrow">SALARY OPERATIONS / PRINT DESK</span><h1>工资表打印工作台</h1></div></header><section class="controls no-print"><label>薪资组<select id="groupSelect"></select></label><label>薪资所属期<input id="cycleInput" maxlength="6"></label><label>纸张<select id="paperSelect"><option value="A4 landscape">A4 横向</option><option value="A3 landscape">A3 横向</option><option value="A4 portrait">A4 纵向</option></select></label><button id="queryButton" class="primary">查询工资表</button><button id="cancelLoadButton" hidden>取消加载</button><button id="saveColumns">保存列配置</button><button id="printButton" disabled>打印预览</button></section><p id="status" class="status"></p><p id="loadProgress" class="status"></p><section id="printSummary" class="print-summary no-print">尚未生成打印版式。</section><section class="workspace"><aside class="column-panel no-print"><div class="panel-heading"><span>打印列</span><button id="resetColumns">重置</button></div><div id="columnEditor"></div></aside><section id="printPages" class="print-pages"><p class="empty">请选择筛选条件并查询。</p></section></section></main>';
  }
  function mount(document) { var root = document.getElementById("app"); if (root) root.innerHTML = createWorkspaceMarkup(); }
  return { createWorkspaceMarkup: createWorkspaceMarkup, mount: mount };
});
