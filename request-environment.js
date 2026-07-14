(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintRequestEnvironment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function shouldEncryptRequests(appTag) { return String(appTag || "").toLowerCase() === "prd"; }
  return { shouldEncryptRequests: shouldEncryptRequests };
});
