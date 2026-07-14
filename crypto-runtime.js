(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintCryptoRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  function findRuntime(windowRef) {
    var candidates = [windowRef];
    try { candidates.push(windowRef.parent, windowRef.parent && windowRef.parent.parent, windowRef.top); } catch (_) {}
    for (var index = 0; index < candidates.length; index += 1) {
      if (candidates[index] && candidates[index].cmbSoftAlgrithm) return candidates[index].cmbSoftAlgrithm;
    }
    return null;
  }

  function ensureCryptoRuntime(options) {
    var settings = options || {};
    var windowRef = settings.root || root;
    var documentRef = settings.document || windowRef.document;
    var existing = findRuntime(windowRef);
    if (existing) return Promise.resolve(existing);
    return new Promise(function (resolve, reject) {
      var script = documentRef.createElement("script");
      script.src = settings.url || "/mainapp2/common/js/common.js";
      script.async = true;
      script.onload = function () {
        var loaded = findRuntime(windowRef);
        if (loaded) resolve(loaded);
        else reject(new Error("common.js 未提供 cmbSoftAlgrithm"));
      };
      script.onerror = function () { reject(new Error("加载 common.js 失败")); };
      documentRef.head.appendChild(script);
    });
  }

  return { ensureCryptoRuntime: ensureCryptoRuntime, findRuntime: findRuntime };
});
