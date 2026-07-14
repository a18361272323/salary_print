const assert = require("node:assert/strict");
const test = require("node:test");
const { ensureCryptoRuntime } = require("../crypto-runtime");

test("loads common.js into the srcdoc window when the parent does not expose the crypto runtime", async () => {
  const root = {};
  let requestedUrl;
  const document = {
    head: { appendChild(script) { requestedUrl = script.src; root.cmbSoftAlgrithm = { CMBSM2Encrypt() {} }; script.onload(); } },
    createElement() { return {}; }
  };

  const runtime = await ensureCryptoRuntime({ root, document });

  assert.equal(runtime, root.cmbSoftAlgrithm);
  assert.equal(requestedUrl, "/mainapp2/common/js/common.js");
});

test("returns an existing crypto runtime without loading another script", async () => {
  const runtime = { CMBSM2Encrypt() {} };
  const result = await ensureCryptoRuntime({ root: { cmbSoftAlgrithm: runtime }, document: { createElement() { throw new Error("should not load"); } } });
  assert.equal(result, runtime);
});
