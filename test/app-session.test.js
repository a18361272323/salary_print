const assert = require("node:assert/strict");
const test = require("node:test");
const session = require("../app-session");

test("invalidates earlier query tokens and binds editor actions to one query snapshot", () => {
  const guard = session.createQueryGuard();
  const first = guard.begin();
  const snapshot = session.createSnapshot("group-1", "202607", first);
  const second = guard.begin();

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  assert.equal(session.matchesSnapshot(snapshot, "group-1", "202607", second), false);
  assert.equal(session.matchesSnapshot(snapshot, "group-1", "202607", first), true);
});

test("opens the print window before asynchronous preparation and closes it on failure", async () => {
  const trace = [];
  const popup = { closed: false, close() { this.closed = true; trace.push("close"); } };
  const result = session.runDirectPrint({
    openWindow() { trace.push("open"); return popup; },
    prepare() { trace.push("prepare"); return Promise.resolve({ canPrint: true }); },
    write() { trace.push("write"); }
  });
  assert.deepEqual(trace, ["open"]);
  await result;
  assert.deepEqual(trace, ["open", "prepare", "write"]);

  await assert.rejects(session.runDirectPrint({
    openWindow() { return popup; },
    prepare() { return Promise.reject(new Error("fit failed")); },
    write() { throw new Error("must not write"); }
  }), /fit failed/);
  assert.equal(popup.closed, true);
});

test("does not publish a query after a newer query starts during asynchronous preparation", async () => {
  const guard = session.createQueryGuard();
  const first = guard.begin();
  let publishCount = 0;
  const prepare = new Promise((resolve) => setImmediate(resolve));
  guard.begin();
  await prepare;

  const published = session.publishIfCurrent(guard, first, () => { publishCount += 1; });
  assert.equal(published, false);
  assert.equal(publishCount, 0);
});
