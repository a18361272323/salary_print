const assert = require("node:assert/strict");
const test = require("node:test");

const { createWorkspaceMarkup } = require("../workspace-template");

test("provides loading progress, print fit summary and physical-page preview root", () => {
  const markup = createWorkspaceMarkup();

  ["groupSelect", "monthPickerButton", "monthPickerDialog", "monthGrid", "queryButton", "paperSelect", "printButton", "saveColumns", "cancelLoadButton", "progressBar", "loadProgress", "printSummary", "printPages", "columnEditor"].forEach((id) => {
    assert.match(markup, new RegExp('id="' + id + '"'));
  });
});
