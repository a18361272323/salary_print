const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function appSource() {
  return fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
}

test("loads the operation coordinator and batch column save client before the app", () => {
  const assets = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets.json"), "utf8"));
  const coordinatorIndex = assets.js.indexOf("./operation-coordinator.js");
  const clientIndex = assets.js.indexOf("./column-config-api-client.js");
  const appIndex = assets.js.indexOf("./app.js");

  assert.ok(coordinatorIndex >= 0);
  assert.ok(clientIndex >= 0);
  assert.ok(coordinatorIndex < appIndex);
  assert.ok(clientIndex < appIndex);
});

test("routes column save through one batch API client call without a preference-store reload", () => {
  const source = appSource();
  const saveColumns = source.match(/async function saveColumns\(\) \{([\s\S]*?)\n    \}/);

  assert.ok(saveColumns);
  assert.match(saveColumns[1], /state\.columnConfigApiClient\.save\(/);
  assert.doesNotMatch(saveColumns[1], /state\.preferenceStore\.save\(/);
  assert.doesNotMatch(saveColumns[1], /state\.preferenceStore\.load\(/);
});

test("uses the coordinator for save and unload protection", () => {
  const source = appSource();

  assert.match(source, /SalaryPrintOperationCoordinator\.createOperationCoordinator/);
  assert.match(source, /runOperation\("initializing"/);
  assert.match(source, /runOperation\("querying"/);
  assert.match(source, /runOperation\("savingColumns"/);
  assert.match(source, /runOperation\("savingLayout"/);
  assert.match(source, /runOperation\("preparingPrint"/);
  assert.match(source, /window\.addEventListener\("beforeunload"/);
  assert.match(source, /state\.operation\.beforeUnloadMessage\(\)/);
});
