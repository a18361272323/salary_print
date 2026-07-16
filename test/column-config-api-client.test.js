const assert = require("node:assert/strict");
const test = require("node:test");

const { createColumnConfigApiClient } = require("../column-config-api-client");

test("sends one complete column snapshot to the custom save API", async () => {
  const calls = [];
  const client = createColumnConfigApiClient({
    run: async (input) => {
      calls.push(input);
      return { savedCount: 1, records: [{ id: 1, column_key: "NETPAY" }], version: 3 };
    }
  });

  const result = await client.save({
    salaryGroupId: "g1",
    salaryCycle: "202606",
    columns: [{ key: "NETPAY", printFlag: true, order: 100, group: "统计", secondGroup: "实发工资", totalFlag: true }]
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    salaryGroupId: "g1",
    salaryCycle: "202606",
    columns: [{ columnKey: "NETPAY", printFlag: 1, displayOrder: 100, topGroup: "统计", secondGroup: "实发工资", totalFlag: 1 }]
  });
  assert.equal(result.savedCount, 1);
  assert.equal(result.records[0].column_key, "NETPAY");
});

test("rejects an incomplete custom save response", async () => {
  const client = createColumnConfigApiClient({ run: async () => ({ savedCount: 1 }) });
  await assert.rejects(client.save({ salaryGroupId: "g1", salaryCycle: "202606", columns: [] }), /records/i);
});
