var assert = require("node:assert/strict");
var test = require("node:test");
var editor = require("../layout-editor");

function makePopupHarness() {
  function element() {
    var listeners = Object.create(null);
    return {
      style: {},
      value: "",
      disabled: false,
      textContent: "",
      className: "",
      innerHTML: "",
      addEventListener: function (name, listener) { listeners[name] = listener; },
      dispatch: function (name, event) { return listeners[name](event || {}); },
      querySelectorAll: function () { return []; }
    };
  }
  var elements = {};
  ["sourceWarning", "saveError", "save", "directPrint", "previewSheet", "inspector", "undo", "redo", "reset", "cancel", "scope"].forEach(function (id) { elements[id] = element(); });
  elements.scope.value = "salary_group";
  var titleSize = element();
  titleSize.name = "title.fontSizePt";
  titleSize.type = "number";
  titleSize.value = "18";
  elements.inspector.querySelectorAll = function (selector) {
    return selector === "[data-width-key]" ? [] : [titleSize];
  };
  var document = {
    open: function () {}, write: function () {}, close: function () {},
    getElementById: function (id) { return elements[id]; }
  };
  var popup = {
    document: document,
    closeCount: 0,
    close: function () { this.closeCount += 1; },
    addEventListener: function () {},
    requestAnimationFrame: function (callback) { callback(); }
  };
  return { window: { closed: false, open: function () { return popup; } }, popup: popup, elements: elements, titleSize: titleSize };
}

function nextTurn() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

test("changes normalized layout drafts without modifying salary rows or column order", function () {
  var rows = [{ _id: "u1", STFNAM: "李明", NETPAY: "100.00" }];
  var columns = [{ key: "STFNAM" }, { key: "NETPAY" }];
  var controller = editor.createDraftController({
    layout: { title: { fontSizePt: 20 } }, rows: rows, columns: columns
  });

  assert.deepEqual(Object.keys(controller).sort(), ["discard", "getDraft", "getHistoryLength", "isDirty", "patch", "redo", "replaceWidth", "undo"]);
  assert.equal(controller.patch("title.fontSizePt", 18), true);
  assert.equal(controller.getDraft().title.fontSizePt, 18);
  assert.deepEqual(rows, [{ _id: "u1", STFNAM: "李明", NETPAY: "100.00" }]);
  assert.deepEqual(columns.map(function (column) { return column.key; }), ["STFNAM", "NETPAY"]);
  assert.equal(controller.patch("rows.0.NETPAY", "0"), false);
  assert.equal(controller.patch("columns.0.key", "REORDERED"), false);
});

test("keeps draft history to thirty snapshots and supports undo, redo, and discard", function () {
  var controller = editor.createDraftController({ layout: {} });
  for (var index = 0; index < 40; index += 1) controller.patch("body.rowHeightPx", 16 + index);

  assert.ok(controller.getHistoryLength() <= 30);
  assert.equal(controller.isDirty(), true);
  assert.equal(controller.undo(), true);
  assert.equal(controller.redo(), true);
  assert.equal(controller.discard(), true);
  assert.equal(controller.isDirty(), false);
  assert.equal(controller.getDraft().body.rowHeightPx, 20);
});

test("normalizes patches and returns defensive draft snapshots", function () {
  var controller = editor.createDraftController({ layout: {} });
  controller.patch("title.color", "#aBc123");
  controller.replaceWidth("NETPAY", 32);
  var snapshot = controller.getDraft();
  snapshot.title.color = "#FFFFFF";
  snapshot.columnWidthsByKey.NETPAY = 1;

  assert.equal(controller.getDraft().title.color, "#ABC123");
  assert.equal(controller.getDraft().columnWidthsByKey.NETPAY, 32);
  assert.equal(controller.replaceWidth("", 30), false);
});

test("opens synchronously with an explicit data lock and reports a blocked popup", function () {
  var blocked = 0;
  var popup = editor.openLayoutEditor({
    window: { open: function () { return null; } },
    onBlocked: function () { blocked += 1; }
  });
  assert.equal(popup, null);
  assert.equal(blocked, 1);

  var source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "layout-editor.js"), "utf8");
  assert.match(source, /数据锁定/);
  assert.match(source, /aria-readonly="true"/);
  assert.doesNotMatch(source, /contenteditable/);
  assert.doesNotMatch(source, /formula/);
  assert.doesNotMatch(source, /field toggle|reorder control/i);
});

test("opens against the browser global window when a caller does not inject one", function () {
  var harness = makePopupHarness();
  var previous = global.window;
  global.window = harness.window;
  try {
    var popup = editor.openLayoutEditor({});
    assert.equal(popup, harness.popup);
  } finally {
    global.window = previous;
  }
});

test("uses the pointer event id and reflects width dragging in the preview before committing history", function () {
  var source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "layout-editor.js"), "utf8");
  assert.match(source, /addEventListener\("pointerdown", function \(event\) \{ if \(!isBusy\(\) && control\.setPointerCapture && event\.pointerId !== undefined\) control\.setPointerCapture\(event\.pointerId\); \}\)/);
  assert.match(source, /sheet\.querySelectorAll\("\[data-preview-key\]"\)/);
  assert.match(source, /cell\.style\.width = width \+ "mm"/);
  assert.match(source, /controller\.replaceWidth\(key, pendingWidths\[key\]\)/);
});

test("uses the printed column minimum as the width slider lower bound", function () {
  var harness = makePopupHarness();
  editor.openLayoutEditor({
    window: harness.window,
    columns: [{ key: "POSSEQ", label: "岗位", widthMm: 20, minWidthMm: 28 }],
    layout: { columnWidthsByKey: { POSSEQ: 14 } }
  });

  assert.match(harness.elements.inspector.innerHTML, /data-width-key="POSSEQ" type="range" min="28" max="80" value="28"/);
  assert.match(harness.elements.previewSheet.innerHTML, /<col data-preview-key="POSSEQ" style="width:28mm">/);
});

test("renders a read-only preview with each editable layout section visibly represented", function () {
  var source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "layout-editor.js"), "utf8");
  ["group-header", "field-header", "<tbody", "<tfoot", "signature", "--salary-group-header-font-family", "--salary-field-header-font-family", "--salary-body-font-family", "--salary-total-font-family", "--salary-signature-font-family"].forEach(function (required) {
    assert.ok(source.indexOf(required) !== -1, required + " should be part of the preview contract");
  });
});

test("awaits one in-flight save and closes only after persistence succeeds", async function () {
  var harness = makePopupHarness();
  var resolveSave;
  var saveCalls = 0;
  editor.openLayoutEditor({
    window: harness.window,
    onSave: function () {
      saveCalls += 1;
      return new Promise(function (resolve) { resolveSave = resolve; });
    }
  });

  harness.elements.save.dispatch("click");
  harness.elements.save.dispatch("click");
  await nextTurn();
  assert.equal(saveCalls, 1);
  assert.equal(harness.popup.closeCount, 0);
  assert.equal(harness.elements.save.disabled, true);
  resolveSave();
  await nextTurn();
  assert.equal(harness.popup.closeCount, 1);
});

test("keeps the editor open and shows an error when asynchronous save fails", async function () {
  var harness = makePopupHarness();
  editor.openLayoutEditor({
    window: harness.window,
    onSave: function () { return Promise.reject(new Error("存储不可用")); }
  });

  harness.elements.save.dispatch("click");
  await nextTurn();
  assert.equal(harness.popup.closeCount, 0);
  assert.equal(harness.elements.save.disabled, false);
  assert.match(harness.elements.saveError.textContent, /存储不可用/);
});

test("locks direct printing until its asynchronous operation finishes and reports failures", async function () {
  var harness = makePopupHarness();
  var rejectPrint;
  var calls = 0;
  editor.openLayoutEditor({
    window: harness.window,
    onPrint: function () { calls += 1; return new Promise(function (_, reject) { rejectPrint = reject; }); }
  });

  harness.elements.directPrint.dispatch("click");
  harness.elements.directPrint.dispatch("click");
  await nextTurn();
  assert.equal(calls, 1);
  assert.equal(harness.elements.directPrint.disabled, true);
  rejectPrint(new Error("打印准备失败"));
  await nextTurn();
  assert.equal(harness.elements.directPrint.disabled, false);
  assert.match(harness.elements.saveError.textContent, /打印准备失败/);
});

test("personal default removes width overrides from both preview controls and save payload", async function () {
  var harness = makePopupHarness();
  var saved;
  editor.openLayoutEditor({
    window: harness.window,
    scope: "personal_default",
    layout: { columnWidthsByKey: { NETPAY: 32 } },
    columns: [{ key: "NETPAY", widthMm: 20 }],
    onSave: function (layout) { saved = layout; }
  });

  assert.doesNotMatch(harness.elements.inspector.innerHTML, /data-width-key/);
  harness.elements.save.dispatch("click");
  await nextTurn();
  assert.equal(saved.columnWidthsByKey, undefined);
});

test("routes inaccessible popup documents to an error callback without throwing", function () {
  var errors = [];
  var result = editor.openLayoutEditor({
    window: { open: function () { return Object.defineProperty({}, "document", { get: function () { throw new Error("跨域窗口"); } }); } },
    onError: function (error) { errors.push(error.message); }
  });
  assert.equal(result, null);
  assert.deepEqual(errors, ["跨域窗口"]);
});

test("rejects draft and scope mutations while an asynchronous save is in flight", async function () {
  var harness = makePopupHarness();
  var rejectFirst;
  var saves = [];
  editor.openLayoutEditor({
    window: harness.window,
    onSave: function (layout, scope) {
      saves.push({ layout: layout, scope: scope });
      if (saves.length === 1) return new Promise(function (_, reject) { rejectFirst = reject; });
    }
  });

  harness.titleSize.dispatch("change");
  harness.elements.save.dispatch("click");
  await nextTurn();
  assert.equal(harness.titleSize.disabled, true);
  assert.equal(harness.elements.undo.disabled, true);
  assert.equal(harness.elements.reset.disabled, true);
  assert.equal(harness.elements.cancel.disabled, true);
  assert.equal(harness.elements.scope.disabled, true);

  harness.titleSize.value = "19";
  harness.titleSize.dispatch("change");
  harness.elements.reset.dispatch("click");
  harness.elements.scope.value = "personal_default";
  harness.elements.scope.dispatch("change");
  rejectFirst(new Error("稍后重试"));
  await nextTurn();

  harness.elements.save.dispatch("click");
  await nextTurn();
  assert.equal(saves[1].layout.title.fontSizePt, 18);
  assert.equal(saves[1].scope, "salary_group");
});
