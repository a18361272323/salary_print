const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createColumnPreferenceStore } = require("../column-preference-store");

test("uses direct model list params and creates or updates every current column", async () => {
  const calls = [];
  const store = createColumnPreferenceStore({ client: { run: async (name, params) => { calls.push({ name, params }); return name === "list" ? { list: [{ id: 8, column_key: "NETPAY", print_flag: 1, display_order: 10, top_group: "结算", total_flag: 1 }] } : {}; } }, getOwnerUserNo: async () => "user-7" });
  const loaded = await store.load({ salaryGroupId: "g1", salaryCycle: "202607" });
  await store.save({ salaryGroupId: "g1", salaryCycle: "202607", records: loaded.records, columns: [{ key: "NETPAY", label: "实发工资", group: "结算", printFlag: true, order: 10, totalFlag: true }] });
  assert.equal(calls[0].name, "list");
  assert.equal(calls[0].params.owner_user_no, "user-7");
  assert.equal(calls[0].params.profile_type, "column");
  assert.equal(calls[1].name, "update");
  assert.equal(calls[1].params.id, 8);
});

test("resolves app logic when it loads after the preference store in srcdoc", async () => {
  const browser = { console };
  browser.globalThis = browser;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "column-preference-store.js"), "utf8"), browser);
  browser.SalaryPrintLogic = {
    fromPreferenceRecords: (records) => records.map((record) => ({ key: record.column_key })),
    toPreferenceRecords: () => []
  };

  const store = browser.SalaryPrintColumnPreferenceStore.createColumnPreferenceStore({ client: { run: async () => ({ list: [{ column_key: "NETPAY" }] }) }, getOwnerUserNo: async () => "user-1" });
  const loaded = await store.load({ salaryGroupId: "group-1", salaryCycle: "202607" });

  assert.deepEqual(loaded.preferences, [{ key: "NETPAY" }]);
});
