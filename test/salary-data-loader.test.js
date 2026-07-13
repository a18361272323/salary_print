const assert = require("node:assert/strict");
const test = require("node:test");

const { loadAllSalaryRows } = require("../salary-data-loader");

test("loads salary records sequentially in 100-row batches", async () => {
  const calls = [];
  const progress = [];
  const result = await loadAllSalaryRows({
    loadPage: async ({ current, size }) => {
      calls.push({ current, size });
      return current === 1 ? { records: Array.from({ length: 100 }, (_, index) => index), total: 101 } : { records: [100], total: 101 };
    },
    onProgress: (value) => progress.push(value)
  });

  assert.deepEqual(calls, [{ current: 1, size: 100 }, { current: 2, size: 100 }]);
  assert.deepEqual(progress, [{ loaded: 100, total: 101, current: 1 }, { loaded: 101, total: 101, current: 2 }]);
  assert.equal(result.records.length, 101);
  assert.equal(result.complete, true);
});

test("rejects an incomplete empty page instead of allowing a partial print", async () => {
  await assert.rejects(() => loadAllSalaryRows({ loadPage: async () => ({ records: [], total: 3 }) }), /分页数据不完整/);
});

test("stops before requesting a new batch when the user cancels", async () => {
  await assert.rejects(() => loadAllSalaryRows({ loadPage: async () => ({ records: [], total: 1 }), isCancelled: () => true }), /已取消加载工资表/);
});
