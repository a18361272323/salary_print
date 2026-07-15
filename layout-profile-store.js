(function (root, factory) {
  var api = factory(function () {
    var config = root.SalaryPrintLayoutConfig;
    if (!config && typeof module === "object" && module.exports) config = require("./layout-config");
    return config;
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintLayoutProfileStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (getConfig) {
  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function sameValue(left, right) {
    return left !== undefined && left !== null && right !== undefined && right !== null && String(left) === String(right);
  }

  function normalizeOwnerUserNo(value) {
    if (typeof value !== "string") return undefined;
    var normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  function isEnabled(record) {
    return record && (record.enabled === true || record.enabled === 1 || record.enabled === "1" || record.enabled === "true");
  }

  function hasGlobalScope(record) {
    return record && record.scope_type === "global" && (record.salary_group_id === "" || record.salary_group_id === null || record.salary_group_id === undefined);
  }

  function hasGroupScope(record, salaryGroupId) {
    return record && record.scope_type === "salary_group" && sameValue(record.salary_group_id, salaryGroupId);
  }

  function config() {
    var current = getConfig();
    if (!current) throw new Error("版式配置逻辑尚未加载");
    return current;
  }

  function parsePayload(record, warnings) {
    var payload = record.layout_payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (error) {
        warnings.push("已忽略无法解析的版式配置");
        return null;
      }
    }
    if (!isPlainObject(payload)) {
      warnings.push("已忽略无效的版式配置");
      return null;
    }
    return payload;
  }

  function listFromResponse(response) {
    if (response && Array.isArray(response.list)) return response.list;
    if (response && response.body && Array.isArray(response.body.list)) return response.body.list;
    return null;
  }

  function emptyResult(ownerUserNo, warnings) {
    return {
      layout: config().createDefaultLayout(),
      records: { global: null, group: null },
      ownerUserNo: ownerUserNo,
      warnings: warnings
    };
  }

  function matchingExisting(records, scope, salaryGroupId, ownerUserNo) {
    var candidates;
    if (Array.isArray(records)) candidates = records;
    else if (records && isPlainObject(records)) candidates = scope === "global" ? [records.global] : [records.group];
    else candidates = [];
    for (var index = 0; index < candidates.length; index += 1) {
      var record = candidates[index];
      if (!isPlainObject(record) || record.id === undefined || !sameValue(record.owner_user_no, ownerUserNo)) continue;
      if (scope === "global" && hasGlobalScope(record)) return record;
      if (scope === "salary_group" && hasGroupScope(record, salaryGroupId)) return record;
    }
    return null;
  }

  function nextVersion(record) {
    var version = Number(record && record.layout_version);
    if (!Number.isFinite(version)) return 1;
    return Math.max(1, Math.floor(version) + 1);
  }

  function createLayoutProfileStore(options) {
    var settings = options || {};
    var client = settings.client;
    var getOwnerUserNo = settings.getOwnerUserNo;
    if (!client || typeof client.run !== "function" || typeof getOwnerUserNo !== "function") throw new Error("版式配置存储配置不完整");

    return {
      load: async function (criteria) {
        var input = criteria || {};
        var ownerUserNo;
        var warnings = [];
        try {
          ownerUserNo = normalizeOwnerUserNo(await getOwnerUserNo());
        } catch (error) {
          warnings.push("无法获取当前用户，已使用默认版式");
          return emptyResult(ownerUserNo, warnings);
        }
        if (!ownerUserNo) {
          warnings.push("无法获取当前用户，已使用默认版式");
          return emptyResult(ownerUserNo, warnings);
        }

        var response;
        try {
          response = await client.run("list", { current: 1, pageSize: 20, owner_user_no: ownerUserNo, enabled: 1 });
        } catch (error) {
          warnings.push("版式配置加载失败，已使用默认版式");
          return emptyResult(ownerUserNo, warnings);
        }
        var records = listFromResponse(response);
        if (!records) {
          warnings.push("版式配置返回格式无效，已使用默认版式");
          return emptyResult(ownerUserNo, warnings);
        }

        var globalRecord = null;
        var groupRecord = null;
        var globalPayload = null;
        var groupPayload = null;
        for (var index = 0; index < records.length; index += 1) {
          var record = records[index];
          if (!isPlainObject(record) || !isEnabled(record) || !sameValue(record.owner_user_no, ownerUserNo)) continue;
          if (!globalRecord && hasGlobalScope(record)) {
            var parsedGlobal = parsePayload(record, warnings);
            if (parsedGlobal) {
              globalRecord = record;
              globalPayload = parsedGlobal;
            }
          }
          if (!groupRecord && hasGroupScope(record, input.salaryGroupId)) {
            var parsedGroup = parsePayload(record, warnings);
            if (parsedGroup) {
              groupRecord = record;
              groupPayload = parsedGroup;
            }
          }
        }
        return {
          layout: config().mergeEffectiveLayout(globalPayload || {}, groupPayload || {}),
          records: { global: globalRecord, group: groupRecord },
          ownerUserNo: ownerUserNo,
          warnings: warnings
        };
      },
      save: async function (input) {
        var settings = input || {};
        var scope = settings.scope;
        if (scope !== "global" && scope !== "salary_group") throw new Error("Unsupported layout profile scope");
        if (scope === "salary_group" && (settings.salaryGroupId === undefined || settings.salaryGroupId === null || settings.salaryGroupId === "")) throw new Error("Salary group scope requires a salaryGroupId");

        var ownerUserNo = normalizeOwnerUserNo(await getOwnerUserNo());
        if (!ownerUserNo) throw new Error("Owner user no is required");
        var existing = matchingExisting(settings.records, scope, settings.salaryGroupId, ownerUserNo);
        var payload = config().toPersistedPayload(settings.layout, scope);
        var fields = {
          owner_user_no: ownerUserNo,
          scope_type: scope,
          salary_group_id: scope === "global" ? "" : settings.salaryGroupId,
          layout_name: "默认版式",
          layout_payload: JSON.stringify(payload),
          layout_version: nextVersion(existing),
          enabled: true
        };
        var operation = existing ? "update" : "create";
        var params = existing ? Object.assign({ id: existing.id }, fields) : fields;
        var response = await client.run(operation, params);
        var persistedRecord = Object.assign({}, existing || {}, fields);
        if (existing) persistedRecord.id = existing.id;
        return { operation: operation, response: response, record: persistedRecord };
      }
    };
  }

  return { createLayoutProfileStore: createLayoutProfileStore };
});
