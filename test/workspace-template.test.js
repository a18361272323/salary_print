const assert = require("node:assert/strict");
const test = require("node:test");

const { createWorkspaceMarkup } = require("../workspace-template");

test("provides loading progress, print fit summary and physical-page preview root", () => {
  const markup = createWorkspaceMarkup();

  ["groupSelect", "cycleInput", "queryButton", "paperSelect", "printButton", "cancelLoadButton", "loadProgress", "printSummary", "printPages", "columnEditor"].forEach((id) => {
    assert.match(markup, new RegExp('id="' + id + '"'));
  });
});
