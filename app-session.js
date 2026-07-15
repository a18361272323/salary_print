(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintAppSession = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createQueryGuard() {
    var generation = 0;
    return {
      begin: function () { generation += 1; return generation; },
      isCurrent: function (token) { return token === generation; },
      current: function () { return generation; }
    };
  }

  function createSnapshot(groupId, cycle, generation) {
    return { groupId: groupId, cycle: cycle, generation: generation };
  }

  function matchesSnapshot(snapshot, groupId, cycle, generation) {
    return Boolean(snapshot) && snapshot.groupId === groupId && snapshot.cycle === cycle && snapshot.generation === generation;
  }

  function publishIfCurrent(guard, token, publish) {
    if (!guard || !guard.isCurrent(token)) return false;
    publish();
    return true;
  }

  function runDirectPrint(options) {
    var settings = options || {};
    var popup = settings.openWindow();
    if (!popup) return Promise.reject(new Error("浏览器拦截了打印窗口，请允许弹窗后重试。"));
    return Promise.resolve().then(function () { return settings.prepare(); }).then(function (prepared) {
      if (!prepared || prepared.canPrint === false) throw new Error("当前版式无法适配纸张，请调整版式后再试印。");
      settings.write(popup, prepared);
      return prepared;
    }).catch(function (error) {
      try { if (popup && popup.closed !== true && typeof popup.close === "function") popup.close(); } catch (_) {}
      throw error;
    });
  }

  return { createQueryGuard: createQueryGuard, createSnapshot: createSnapshot, matchesSnapshot: matchesSnapshot, publishIfCurrent: publishIfCurrent, runDirectPrint: runDirectPrint };
});
