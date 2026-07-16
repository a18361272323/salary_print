const assert = require("node:assert/strict");
const test = require("node:test");

const { createOperationCoordinator } = require("../operation-coordinator");

test("locks a second operation until the active operation settles", async () => {
  let release;
  const states = [];
  const coordinator = createOperationCoordinator({ onChange: (state) => states.push(state) });
  const first = coordinator.run("savingColumns", () => new Promise((resolve) => { release = resolve; }));

  assert.equal(coordinator.isBusy(), true);
  await assert.rejects(coordinator.run("querying", () => Promise.resolve()), /正在保存列配置/);
  assert.match(coordinator.beforeUnloadMessage(), /正在保存列配置/);

  release({ savedCount: 2 });
  await first;

  assert.equal(coordinator.isBusy(), false);
  assert.equal(coordinator.beforeUnloadMessage(), "");
  assert.equal(states.at(-1).kind, "idle");
});
