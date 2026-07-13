const assert = require("node:assert/strict");
const test = require("node:test");
const { createModelMethodClient } = require("../model-method-client");

test("runs the fixed XFT model method endpoint with direct JSON params", async () => {
  let request;
  const client = createModelMethodClient({ baseUrl: "https://example.test/xcodegw/app/app-1/tag/dev", modelKey: "model-1", methods: { list: "method-1" }, fetch: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ returnCode: "SUC0000", body: { list: [] } }) }; } });
  await client.run("list", { current: 1, pageSize: 20 });
  assert.match(request.url, /modelKey=model-1/);
  assert.equal(request.options.body, '{"current":1,"pageSize":20}');
  assert.equal(request.options.credentials, "include");
});
