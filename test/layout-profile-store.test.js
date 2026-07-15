const assert = require("node:assert/strict");
const test = require("node:test");
const { createLayoutProfileStore } = require("../layout-profile-store");

function profile(overrides) {
  return Object.assign({
    id: 1,
    owner_user_no: "user-7",
    profile_type: "layout",
    layout_scope: "personal_default",
    column_key: "layout_profile",
    salary_group_id: "",
    enabled: 1,
    layout_version: 1,
    layout_payload: { title: { fontSizePt: 18 } }
  }, overrides);
}

function makeStore(records, calls) {
  return createLayoutProfileStore({
    client: {
      run: async (method, params) => {
        calls.push({ method, params });
        return method === "list" ? { body: { list: records } } : { method, id: params.id || 99 };
      }
    },
    getOwnerUserNo: async () => "user-7"
  });
}

test("load scopes records to the resolved owner and layers group payload over global", async () => {
  const calls = [];
  const store = makeStore([
    profile({ layout_payload: JSON.stringify({ title: { fontSizePt: 18 }, body: { rowHeightPx: 24 } }) }),
    profile({ id: 2, layout_scope: "salary_group", salary_group_id: "group-1", layout_payload: { title: { fontSizePt: 16 }, columnWidthsByKey: { NETPAY: 36 } } }),
    profile({ id: 3, owner_user_no: "another-user", layout_payload: { title: { fontSizePt: 8 } } })
  ], calls);

  const loaded = await store.load({ salaryGroupId: "group-1" });

  assert.deepEqual(calls[0], { method: "list", params: { current: 1, pageSize: 20, owner_user_no: "user-7", profile_type: "layout", enabled: 1 } });
  assert.equal(loaded.layout.title.fontSizePt, 16);
  assert.equal(loaded.layout.body.rowHeightPx, 24);
  assert.deepEqual(loaded.layout.columnWidthsByKey, { NETPAY: 36 });
  assert.equal(loaded.records.global.id, 1);
  assert.equal(loaded.records.group.id, 2);
  assert.equal(loaded.ownerUserNo, "user-7");
});

test("load falls back from malformed and inapplicable records without throwing", async () => {
  const calls = [];
  const store = makeStore([
    profile({ id: 1, layout_payload: "not-json" }),
    profile({ id: 2, enabled: 0, layout_payload: { title: { fontSizePt: 8 } } }),
    profile({ id: 3, layout_scope: "salary_group", salary_group_id: "other-group", layout_payload: { title: { fontSizePt: 8 } } })
  ], calls);

  const loaded = await store.load({ salaryGroupId: "group-1" });

  assert.equal(loaded.layout.title.fontSizePt, 20);
  assert.equal(loaded.records.global, null);
  assert.equal(loaded.records.group, null);
  assert.ok(loaded.warnings.length > 0);
});

test("load returns default layout and a warning when profile listing fails", async () => {
  const store = createLayoutProfileStore({
    client: { run: async () => { throw new Error("network unavailable"); } },
    getOwnerUserNo: async () => "user-7"
  });

  const loaded = await store.load({ salaryGroupId: "group-1" });

  assert.equal(loaded.layout.title.fontSizePt, 20);
  assert.equal(loaded.records.global, null);
  assert.ok(loaded.warnings.some((warning) => /加载/.test(warning)));
});

test("load accepts a top-level list response", async () => {
  const store = createLayoutProfileStore({
    client: { run: async () => ({ list: [profile({ layout_payload: { title: { fontSizePt: 17 } } })] }) },
    getOwnerUserNo: async () => "user-7"
  });

  const loaded = await store.load({ salaryGroupId: "group-1" });

  assert.equal(loaded.layout.title.fontSizePt, 17);
  assert.equal(loaded.records.global.id, 1);
  assert.deepEqual(loaded.warnings, []);
});

test("loads later pages and deterministically selects the highest-version duplicate profile", async () => {
  const calls = [];
  const pages = [
    Array.from({ length: 20 }, (_, index) => profile({ id: index + 100, layout_scope: "salary_group", salary_group_id: "other" })),
    [
      profile({ id: 4, layout_version: 2, layout_payload: { title: { fontSizePt: 16 } } }),
      profile({ id: 9, layout_version: 3, layout_payload: { title: { fontSizePt: 17 } } }),
      profile({ id: 10, layout_scope: "salary_group", salary_group_id: "group-1", layout_version: 1, layout_payload: { title: { fontSizePt: 15 } } }),
      profile({ id: 12, layout_scope: "salary_group", salary_group_id: "group-1", layout_version: 2, layout_payload: { title: { fontSizePt: 14 } } })
    ]
  ];
  const store = createLayoutProfileStore({
    client: { run: async (method, params) => { calls.push(params); return { body: { list: pages[params.current - 1] || [], total: 24 } }; } },
    getOwnerUserNo: async () => "user-7"
  });
  const loaded = await store.load({ salaryGroupId: "group-1" });

  assert.equal(calls.length, 2);
  assert.equal(loaded.records.global.id, 9);
  assert.equal(loaded.records.group.id, 12);
  assert.equal(loaded.layout.title.fontSizePt, 14);
});

test("fails safely when a later empty page contradicts the reported total", async () => {
  const calls = [];
  const store = createLayoutProfileStore({
    client: { run: async (method, params) => { calls.push(params.current); return { body: { list: params.current === 1 ? [profile()] : [], total: 21 } }; } },
    getOwnerUserNo: async () => "user-7"
  });
  const loaded = await store.load({ salaryGroupId: "group-1" });

  assert.deepEqual(calls, [1, 2]);
  assert.equal(loaded.records.global, null);
  assert.ok(loaded.warnings.some((warning) => /加载/.test(warning)));
});

test("load falls back to defaults when owner resolution or list response is invalid", async () => {
  const ownerFailureStore = createLayoutProfileStore({
    client: { run: async () => { throw new Error("must not list"); } },
    getOwnerUserNo: async () => { throw new Error("no owner"); }
  });
  const invalidResponseStore = createLayoutProfileStore({
    client: { run: async () => ({ body: { rows: [] } }) },
    getOwnerUserNo: async () => "user-7"
  });

  const ownerFallback = await ownerFailureStore.load({ salaryGroupId: "group-1" });
  const responseFallback = await invalidResponseStore.load({ salaryGroupId: "group-1" });

  assert.equal(ownerFallback.layout.title.fontSizePt, 20);
  assert.ok(ownerFallback.warnings.length > 0);
  assert.equal(responseFallback.layout.title.fontSizePt, 20);
  assert.ok(responseFallback.warnings.length > 0);
});

test("load treats blank or missing owner values as an unresolved owner without listing", async () => {
  for (const ownerUserNo of ["", "   ", undefined, null]) {
    let calls = 0;
    const store = createLayoutProfileStore({
      client: { run: async () => { calls += 1; return { list: [] }; } },
      getOwnerUserNo: async () => ownerUserNo
    });

    const loaded = await store.load({ salaryGroupId: "group-1" });

    assert.equal(calls, 0);
    assert.equal(loaded.layout.title.fontSizePt, 20);
    assert.equal(loaded.ownerUserNo, undefined);
    assert.ok(loaded.warnings.length > 0);
  }
});

test("save updates the matching personal-default profile with widths excluded and version incremented", async () => {
  const calls = [];
  const store = makeStore([], calls);
  const result = await store.save({
    scope: "personal_default",
    layout: { title: { fontSizePt: 17 }, columnWidthsByKey: { NETPAY: 36 } },
    records: { global: profile({ id: 8, layout_version: 3 }), group: null }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "update");
  assert.equal(calls[0].params.id, 8);
  assert.equal(calls[0].params.owner_user_no, "user-7");
  assert.equal(calls[0].params.profile_type, "layout");
  assert.equal(calls[0].params.layout_scope, "personal_default");
  assert.equal(calls[0].params.column_key, "layout_profile");
  assert.equal(calls[0].params.salary_group_id, "");
  assert.equal(calls[0].params.layout_version, 4);
  assert.equal(calls[0].params.enabled, true);
  assert.equal(calls[0].params.layout_payload.columnWidthsByKey, undefined);
  assert.equal(result.operation, "update");
  assert.equal(result.record.id, 8);
  assert.deepEqual(result.response, { method: "update", id: 8 });
});

test("save creates a salary-group profile and retains its column widths", async () => {
  const calls = [];
  const store = makeStore([], calls);
  const result = await store.save({
    scope: "salary_group",
    salaryGroupId: "group-1",
    layout: { title: { fontSizePt: 17 }, columnWidthsByKey: { NETPAY: 36 } },
    records: { global: null, group: null }
  });

  assert.equal(calls[0].method, "create");
  assert.equal(calls[0].params.salary_group_id, "group-1");
  assert.equal(calls[0].params.layout_version, 1);
  assert.deepEqual(calls[0].params.layout_payload.columnWidthsByKey, { NETPAY: 36 });
  assert.equal(result.record.layout_scope, "salary_group");
});

test("save creates rather than updating a matching-looking record owned by someone else", async () => {
  const calls = [];
  const store = makeStore([], calls);

  await store.save({
    scope: "personal_default",
    layout: {},
    records: { global: profile({ id: 8, owner_user_no: "another-user" }), group: null }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "create");
  assert.equal(calls[0].params.id, undefined);
});

test("save rejects blank or missing owner values before writing", async () => {
  for (const ownerUserNo of ["", "   ", undefined, null]) {
    let calls = 0;
    const store = createLayoutProfileStore({
      client: { run: async () => { calls += 1; } },
      getOwnerUserNo: async () => ownerUserNo
    });

    await assert.rejects(store.save({ scope: "personal_default", layout: {} }), /owner/i);
    assert.equal(calls, 0);
  }
});

test("save rejects unsupported scopes before contacting the client", async () => {
  let calls = 0;
  const store = createLayoutProfileStore({
    client: { run: async () => { calls += 1; } },
    getOwnerUserNo: async () => { calls += 1; return "user-7"; }
  });

  await assert.rejects(store.save({ scope: "employee", layout: {} }), /scope/i);
  assert.equal(calls, 0);
});

test("save rejects a salary-group scope without salaryGroupId before contacting the client", async () => {
  let calls = 0;
  const store = createLayoutProfileStore({
    client: { run: async () => { calls += 1; } },
    getOwnerUserNo: async () => { calls += 1; return "user-7"; }
  });

  await assert.rejects(store.save({ scope: "salary_group", layout: {} }), /salaryGroupId/i);
  assert.equal(calls, 0);
});
