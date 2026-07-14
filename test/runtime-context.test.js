const assert = require("node:assert/strict");
const test = require("node:test");
const { createRuntimeContext } = require("../runtime-context");

test("derives the model-method base URL and reads enterpriseUserKey", async () => {
  let requested;
  const context = createRuntimeContext({ location: { origin: "https://xft-demo.cmburl.cn", pathname: "/XFTPRO/app-1/dev/preview/entry/pc" }, fetch: async (url) => { requested = url; return { ok: true, status: 200, text: async () => '<script>{"enterpriseUserKey":"user-7"}</script>' }; } });
  assert.equal(context.baseUrl, "https://xft-demo.cmburl.cn/xcodegw/app/app-1/tag/dev");
  assert.equal(await context.getOwnerUserNo(), "user-7");
  assert.match(requested, /render\/entry\/pc$/);
});

test("prefers the host-provided envTag over the route tag", () => {
  const context = createRuntimeContext({ location: { origin: "https://xft-demo.cmburl.cn", pathname: "/XFTPRO/app-1/dev/preview/entry/pc" }, envTag: "uat", fetch: async () => ({ ok: true, text: async () => "" }) });
  assert.equal(context.baseUrl, "https://xft-demo.cmburl.cn/xcodegw/app/app-1/tag/uat");
});
