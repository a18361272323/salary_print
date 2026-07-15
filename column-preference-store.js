(function (root, factory) {
  var api = factory(function () {
    var logic = root.SalaryPrintLogic;
    if (!logic && typeof module === "object" && module.exports) logic = require("./app-logic");
    return logic;
  });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SalaryPrintColumnPreferenceStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (getLogic) {
  function createColumnPreferenceStore(options) {
    var settings = options || {};
    var client = settings.client;
    var getOwnerUserNo = settings.getOwnerUserNo;
    if (!client || !getOwnerUserNo) throw new Error("列配置存储配置不完整");

    function logic() {
      var current = getLogic();
      if (!current) throw new Error("列配置逻辑尚未加载");
      return current;
    }

    return {
      load: async function (criteria) {
        var input = criteria || {};
        var owner = await getOwnerUserNo();
        var response = await client.run("list", { current: 1, pageSize: 200, owner_user_no: owner, salary_group_id: input.salaryGroupId, salary_cycle: input.salaryCycle, profile_type: "column", enabled: 1 });
        var records = response.list || [];
        return { records: records, preferences: logic().fromPreferenceRecords(records) };
      },
      save: async function (input) {
        var config = input || {};
        var owner = await getOwnerUserNo();
        var records = logic().toPreferenceRecords({ ownerUserNo: owner, salaryGroupId: config.salaryGroupId, salaryCycle: config.salaryCycle, columns: config.columns });
        var existing = new Map((config.records || []).map(function (row) { return [row.column_key, row]; }));
        for (var index = 0; index < records.length; index += 1) {
          var record = records[index];
          var old = existing.get(record.column_key);
          await client.run(old && old.id !== undefined ? "update" : "create", old && old.id !== undefined ? Object.assign({ id: old.id }, record) : record);
        }
        return records;
      }
    };
  }

  return { createColumnPreferenceStore: createColumnPreferenceStore };
});
