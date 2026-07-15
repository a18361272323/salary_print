const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("reuses the column model client for isolated column and layout profile stores", () => {
  assert.doesNotMatch(appSource, /SalaryPrintLayoutModelConfig/);
  assert.match(appSource, /function initializeProfileStores\(\)/);
  assert.match(appSource, /SalaryPrintColumnPreferenceStore\.createColumnPreferenceStore\(\{\s*client:\s*client/);
  assert.match(appSource, /SalaryPrintLayoutProfileStore\.createLayoutProfileStore\(\{\s*client:\s*client/);
  assert.equal((appSource.match(/SalaryPrintModelMethodClient\.createModelMethodClient/g) || []).length, 1);
  assert.match(appSource, /state\.preferenceStore\s*=\s*stores\.preferenceStore;\s*state\.layoutStore\s*=\s*stores\.layoutStore/);
});

test("loads headers, column preferences, and layout profiles together before rendering", () => {
  assert.match(appSource, /Promise\.all\(\[\s*post\(endpoints\.headers,[\s\S]*?state\.preferenceStore\s*\?\s*state\.preferenceStore\.load[\s\S]*?state\.layoutStore\s*\?\s*state\.layoutStore\.load/);
  assert.match(appSource, /state\.layoutRecords\s*=\s*layouts\.records;\s*state\.layout\s*=\s*layouts\.layout/);
  assert.match(appSource, /\$\("editLayout"\)\.disabled\s*=\s*false/);
});

test("keeps source columns authoritative and prints workflow effective columns with layout tokens", () => {
  assert.match(appSource, /var layout\s*=\s*layoutOverride\s*\?\s*SalaryPrintLayoutConfig\.normalizeLayout\(layoutOverride\)\s*:\s*layoutForCurrentPaper\(\)/);
  assert.match(appSource, /columns:\s*state\.columns,\s*layout:\s*layout/);
  assert.match(appSource, /var columns\s*=\s*printDocument\.columns/);
  assert.match(appSource, /renderPages\(state\.document\)/);
  assert.match(appSource, /layout:\s*printDocument\.layout/);
  assert.match(appSource, /layoutCssVariables:\s*fit\.layoutCssVariables,\s*pageMarginMm:\s*fit\.pageMarginMm/);
  assert.match(appSource, /scope:\s*"salary_group"/);
});

test("opens the editor with the current transient paper and prints popup drafts without replacing the parent document", () => {
  assert.match(appSource, /SalaryPrintLayoutEditor\.openLayoutEditor\(\{[\s\S]*?layout:\s*layoutForCurrentPaper\(\)/);
  assert.match(appSource, /onPrint:\s*function \(layout\) \{[\s\S]*?SalaryPrintAppSession\.runDirectPrint\([\s\S]*?prepareDocument\(SalaryPrintLayoutConfig\.normalizeLayout\(layout\)\)/);
  assert.doesNotMatch(appSource, /onPrint:\s*function \(layout\) \{[\s\S]{0,500}?state\.document\s*=/);
});

test("uses a normalized popup draft paper for its own fit calculation while preserving the main paper selection path", () => {
  assert.match(appSource, /async function prepareDocument\(layoutOverride\) \{[\s\S]*?var layout\s*=\s*layoutOverride\s*\?\s*SalaryPrintLayoutConfig\.normalizeLayout\(layoutOverride\)\s*:\s*layoutForCurrentPaper\(\);[\s\S]*?var paper\s*=\s*layoutOverride\s*\?\s*layout\.page\.paper\s*:\s*\$\("paperSelect"\)\.value;[\s\S]*?preparePrintDocument\(\{\s*paper:\s*paper/);
});

test("checks the query token again after preparing before enabling layout editing", () => {
  assert.match(appSource, /await prepare\(undefined, queryToken\);\s*if \(!state\.queryGuard\.isCurrent\(queryToken\)\) return;\s*\$\("editLayout"\)\.disabled\s*=\s*false/);
});
