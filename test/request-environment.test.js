const assert = require("node:assert/strict");
const test = require("node:test");
const { shouldEncryptRequests } = require("../request-environment");

test("uses request encryption only for the production app tag", () => {
  assert.equal(shouldEncryptRequests("dev"), false);
  assert.equal(shouldEncryptRequests("uat"), false);
  assert.equal(shouldEncryptRequests("prd"), true);
});
