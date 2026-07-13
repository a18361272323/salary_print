(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintModelMethodClient = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createModelMethodClient(config) {
    var settings = config || {};
    var baseUrl = String(settings.baseUrl || "").replace(/\/$/, "");
    var request = settings.fetch || root.fetch;
    if (!baseUrl || !settings.modelKey || !request) throw new Error("模型方法客户端配置不完整");
    var tag = (baseUrl.match(/\/tag\/([^/?#]+)/) || [])[1];
    if (!tag) throw new Error("模型方法 baseUrl 缺少 appTag");
    return { run: async function (name, params) {
      var methodKey = settings.methods && settings.methods[name];
      if (!methodKey) throw new Error("未配置模型方法：" + name);
      var query = new URLSearchParams({ appTag: tag, modelKey: settings.modelKey, methodKey: methodKey });
      var response = await request(baseUrl + "/api/run/odexftopenapiv2appmodelmethodrun?" + query.toString(), { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json, text/plain, */*", "xcode-appsource": "procode" }, credentials: "include", body: JSON.stringify(params || {}) });
      var envelope = await response.json().catch(function () { return {}; });
      if (!response.ok || (envelope.returnCode && envelope.returnCode !== "SUC0000") || (envelope.code && !["SUC0000", 0, 200].includes(envelope.code))) throw new Error(envelope.errorMsg || envelope.message || "模型方法调用失败");
      return envelope.body || envelope.data || envelope;
    } };
  }
  return { createModelMethodClient: createModelMethodClient };
});
