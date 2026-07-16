const assert = require("node:assert/strict");
const test = require("node:test");

const { createWorkspaceMarkup } = require("../workspace-template");

test("provides loading progress, print fit summary and physical-page preview root", () => {
  const markup = createWorkspaceMarkup();

  ["groupSelect", "monthPickerButton", "monthPickerDialog", "monthGrid", "queryButton", "paperSelect", "printButton", "saveColumns", "editLayout", "layoutProfileStatus", "cancelLoadButton", "progressBar", "loadProgress", "printSummary", "printPages", "columnEditor"].forEach((id) => {
    assert.match(markup, new RegExp('id="' + id + '"'));
  });
  assert.match(markup, /<option value="B4 landscape">B4 横向<\/option>/);
  assert.match(markup, /id="queryButton" class="primary">查询<\/button>/);
  assert.match(markup, /字段顺序与显示请在左侧“打印列”调整。/);
  assert.match(markup, /class="column-panel[^>]*>[\s\S]*id="columnEditor"/);
  assert.doesNotMatch(markup, /masthead reveal/);
});

test("provides an accessible global operation status region", () => {
  const markup = createWorkspaceMarkup();

  assert.match(markup, /id="operationStatus"[^>]*aria-live="polite"/);
  assert.match(markup, /id="operationSpinner"/);
});
