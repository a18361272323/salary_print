(function (root) {
  import("https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/modular/sortable.esm.js")
    .then(function (module) { root.SalaryPrintSortable = module.default || module.Sortable; })
    .catch(function (error) { console.error("SortableJS 加载失败", error); });
})(typeof globalThis !== "undefined" ? globalThis : this);
