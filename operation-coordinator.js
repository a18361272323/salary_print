(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintOperationCoordinator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var LABELS = {
    initializing: "正在加载薪资组",
    querying: "正在查询工资表",
    savingColumns: "正在保存列配置",
    savingLayout: "正在保存版式配置",
    preparingPrint: "正在准备打印"
  };

  function createOperationCoordinator(options) {
    var settings = options || {};
    var onChange = typeof settings.onChange === "function" ? settings.onChange : function () {};
    var active = null;

    function snapshot() {
      if (!active) return { kind: "idle", label: "", startedAt: 0, progress: null };
      return { kind: active.kind, label: active.label, startedAt: active.startedAt, progress: active.progress };
    }

    function notify() { onChange(snapshot()); }

    function run(kind, operation) {
      if (active) return Promise.reject(new Error(active.label + "，请稍候。"));
      if (typeof operation !== "function") return Promise.reject(new Error("操作处理函数无效"));
      active = { kind: kind, label: LABELS[kind] || "正在处理", startedAt: Date.now(), progress: null };
      notify();
      return Promise.resolve().then(operation).then(function (result) {
        active = null;
        notify();
        return result;
      }, function (error) {
        active = null;
        notify();
        throw error;
      });
    }

    return {
      run: run,
      isBusy: function () { return active !== null; },
      current: snapshot,
      beforeUnloadMessage: function () { return active && (active.kind === "savingColumns" || active.kind === "savingLayout") ? active.label + "，请勿关闭页面。" : ""; }
    };
  }

  return { createOperationCoordinator: createOperationCoordinator };
});
