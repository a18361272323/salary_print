const assert = require("node:assert/strict");
const test = require("node:test");
const { createColumnPreferenceStore } = require("../column-preference-store");

test("uses direct model list params and creates or updates every current column", async () => {
  const calls = [];
  const store = createColumnPreferenceStore({ client: { run: async (name, params) => { calls.push({ name, params }); return name === "list" ? { list: [{ id: 8, column_key: "NETPAY", print_flag: 1, display_order: 10, top_group: "结算", total_flag: 1 }] } : {}; } }, getOwnerUserNo: async () => "user-7" });
  const loaded = await store.load({ salaryGroupId: "g1", salaryCycle: "202607" });
  await store.save({ salaryGroupId: "g1", salaryCycle: "202607", records: loaded.records, columns: [{ key: "NETPAY", label: "实发工资", group: "结算", printFlag: true, order: 10, totalFlag: true }] });
  assert.equal(calls[0].name, "list");
  assert.equal(calls[0].params.owner_user_no, "user-7");
  assert.equal(calls[1].name, "update");
  assert.equal(calls[1].params.id, 8);
});
