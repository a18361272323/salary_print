# 工资表自适应分页与纸张策略 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有工资表打印微前端升级为可加载全量数据、按物理页连续打印、保留尾页汇总签字区并能提示 A4/A3 纸张升级的产品化打印工作台。

**Architecture:** 保持工资接口加密调用和列配置存储不变。新增纯函数的打印布局引擎与顺序分页加载器；`app.js` 只负责协调查询、状态与 DOM 渲染。打印预览不再把一个 HTML table 直接交给浏览器自动分页，而是渲染首/中/尾物理页容器并由 CSS 固定页尺寸。

**Tech Stack:** 原生浏览器 JavaScript、Node.js 内建 `node:test`、CSS Paged Media、XFT 同源 srcdoc、现有模型方法客户端。

---

## File Structure

- `index.html`：加载根节点与脚本顺序。
- `workspace-template.js`：筛选、适配摘要、纸张选择、加载进度和打印页容器的静态结构。
- `salary-data-loader.js`：工资分页接口的顺序全量读取和取消/进度通知。
- `print-layout.js`：纸张规格、字号/宽度适配、首页/续页/尾页的确定性分页。
- `app-logic.js`：列偏好转换、行解析、合计，并补充列宽与打印字段信息。
- `app.js`：加密请求、批次查询、适配提示、打印预览 DOM 渲染。
- `app.css`：屏幕摘要、物理页容器、打印尺寸与分页样式。
- `test/*.test.js`：打印布局、全量加载、既有列配置和运行时上下文回归测试。
- `README.md`：运行、打印规则、模型配置注入和 srcdoc 发布说明。

### Task 1: 初始化仓库与迁入现有微前端

**Files:**
- Create: `package.json`
- Create: `index.html`, `app.css`, `app.js`, `app-logic.js`, `workspace-template.js`
- Create: `model-method-client.js`, `runtime-context.js`, `column-preference-store.js`, `srcdoc-manifest.template.json`
- Create: `test/app-logic.test.js`, `test/model-method-client.test.js`, `test/runtime-context.test.js`, `test/column-preference-store.test.js`, `test/workspace-template.test.js`
- Create: `README.md`

- [ ] **Step 1: 迁入现有受测代码，不改动行为**

从 `C:/Users/Administrator/Documents/xft.cmbchina.com (2)/work/salary-print-microfrontend/` 迁入上述文件。保留 UMD 导出、模型方法接口形状、`enterpriseUserKey` 提取和现有列配置测试。

- [ ] **Step 2: 运行基线测试**

Run: `npm test && npm run check`

Expected: 10 项既有测试通过，且所有 JavaScript 文件通过 `node --check`。

- [ ] **Step 3: 提交基线**

```powershell
git add .
git commit -m "chore: initialize salary print microfrontend"
```

### Task 2: 构建纸张适配与确定性分页引擎

**Files:**
- Create: `print-layout.js`
- Create: `test/print-layout.test.js`

- [ ] **Step 1: 写失败测试，覆盖 A4/A3 适配与尾页预留**

```javascript
const { evaluatePaperFit, paginatePrintRows } = require("../print-layout");

test("suggests A3 landscape instead of reducing an A4 print below 6.5pt", () => {
  const result = evaluatePaperFit({ paper: "A4 landscape", columns: [{ minWidthMm: 130 }, { minWidthMm: 130 }, { minWidthMm: 130 }] });
  assert.deepEqual(result, { status: "suggest-a3", paper: "A4 landscape", fontPt: 6.5, suggestedPaper: "A3 landscape" });
});

test("reserves the final page for totals and signatures", () => {
  const pages = paginatePrintRows({ rows: Array.from({ length: 55 }, (_, index) => ({ id: index + 1 })), layout: { firstPageRows: 18, middlePageRows: 24, lastPageRows: 12 } });
  assert.deepEqual(pages.map((page) => [page.kind, page.rows.length]), [["first", 18], ["middle", 24], ["middle", 1], ["last", 12]]);
  assert.equal(pages.at(-1).includeSummary, true);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/print-layout.test.js`

Expected: FAIL，提示找不到 `../print-layout`。

- [ ] **Step 3: 实现纯函数布局模块**

`print-layout.js` 导出：

```javascript
const PAPERS = {
  "A4 landscape": { widthMm: 279, heightMm: 192, preferredFontPt: 9 },
  "A3 landscape": { widthMm: 402, heightMm: 279, preferredFontPt: 9 },
  "A4 portrait": { widthMm: 192, heightMm: 279, preferredFontPt: 9 }
};

function evaluatePaperFit({ paper, columns }) {
  const required = columns.reduce((total, column) => total + Number(column.minWidthMm || 18), 0);
  const spec = PAPERS[paper];
  const ratio = Math.min(1, spec.widthMm / required);
  const fontPt = Math.max(6.5, Math.round(spec.preferredFontPt * ratio * 2) / 2);
  const scaledWidthMm = required * fontPt / spec.preferredFontPt;
  if (scaledWidthMm <= spec.widthMm) return { status: "fit", paper, fontPt, requiredWidthMm: required };
  if (paper !== "A3 landscape") return { status: "suggest-a3", paper, fontPt: 6.5, suggestedPaper: "A3 landscape" };
  return { status: "adjust-columns", paper, fontPt: 6.5, requiredWidthMm: required };
}

function derivePageCapacity(paper, fontPt) {
  // 根据纸张高度、固定 9mm 边距、首/中/尾页区域和固定行高返回三种容量。
}

function paginatePrintRows({ rows, layout }) {
  // 先尝试尾页容量；尾页无法放置数据时保留纯尾页；非尾页按首页/中间页容量分配。
}
```

`derivePageCapacity` 和 `paginatePrintRows` 必须返回符合容量上限的 `{ kind, rows, includeSummary }[]`；输入行既不遗漏也不重复，`last` 仅出现一次且 `includeSummary: true`。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/print-layout.test.js`

Expected: 所有布局测试通过；增加 A3 仍不适配与 101 行连续页码用例。

- [ ] **Step 5: 提交布局模块**

```powershell
git add print-layout.js test/print-layout.test.js
git commit -m "feat: add adaptive print layout engine"
```

### Task 3: 构建顺序全量工资数据加载器

**Files:**
- Create: `salary-data-loader.js`
- Create: `test/salary-data-loader.test.js`

- [ ] **Step 1: 写失败测试，验证 101 行与进度**

```javascript
const { loadAllSalaryRows } = require("../salary-data-loader");

test("loads salary records sequentially in 100-row batches", async () => {
  const calls = [];
  const result = await loadAllSalaryRows({
    loadPage: async ({ current, size }) => {
      calls.push({ current, size });
      return current === 1 ? { records: Array.from({ length: 100 }, (_, i) => i), total: 101 } : { records: [100], total: 101 };
    },
    onProgress: () => {}
  });
  assert.deepEqual(calls, [{ current: 1, size: 100 }, { current: 2, size: 100 }]);
  assert.equal(result.records.length, 101);
  assert.equal(result.complete, true);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/salary-data-loader.test.js`

Expected: FAIL，提示找不到模块。

- [ ] **Step 3: 实现顺序加载与错误边界**

实现 `loadAllSalaryRows({ loadPage, pageSize = 100, onProgress, isCancelled })`：

```javascript
while (records.length < total) {
  if (isCancelled && isCancelled()) throw new Error("已取消加载工资表");
  const page = await loadPage({ current, size: pageSize });
  records.push(...page.records);
  total = Number(page.total || total || records.length);
  onProgress({ loaded: records.length, total, current });
  current += 1;
}
return { records, total, complete: true };
```

空页而尚未达到 `total` 时必须抛出“分页数据不完整”，防止无穷循环或不完整打印。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/salary-data-loader.test.js`

Expected: 101 行、取消、空页异常和单页数据测试全部通过。

- [ ] **Step 5: 提交数据加载器**

```powershell
git add salary-data-loader.js test/salary-data-loader.test.js
git commit -m "feat: load complete salary data in batches"
```

### Task 4: 扩展列模型与工作台交互

**Files:**
- Modify: `app-logic.js`
- Modify: `workspace-template.js`
- Modify: `index.html`
- Modify: `test/app-logic.test.js`
- Modify: `test/workspace-template.test.js`

- [ ] **Step 1: 先写失败测试**

为 `buildColumns` 增加 `minWidthMm`：员工姓名最小 28mm，身份证号最小 34mm，合计金额最小 20mm，其他列默认 18mm。为模板测试加入 `printSummary`、`loadProgress`、`printPages`、`cancelLoadButton` 四个 id。

- [ ] **Step 2: 运行相关测试确认失败**

Run: `node --test test/app-logic.test.js test/workspace-template.test.js`

Expected: FAIL，断言缺少列最小宽度或新控件 id。

- [ ] **Step 3: 实现列宽语义与工作台控件**

在 `buildColumns` 返回对象中加入：

```javascript
minWidthMm: saved.widthMm || minimumPrintWidth(header),
optional: !baseKeys.has(header.itemKey) && !["STFNAM", "STFIDN", "GRSPAY", "NETPAY"].includes(header.itemKey)
```

模板加入：适配摘要容器、加载进度文本、取消按钮、打印页容器。保留现有列编辑和保存配置入口。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/app-logic.test.js test/workspace-template.test.js`

Expected: 既有列偏好回归测试与新增宽度/控件测试通过。

- [ ] **Step 5: 提交工作台扩展**

```powershell
git add app-logic.js workspace-template.js index.html test/app-logic.test.js test/workspace-template.test.js
git commit -m "feat: expose print fit controls and column widths"
```

### Task 5: 接入打印管线与物理页渲染

**Files:**
- Modify: `app.js`
- Modify: `app.css`
- Modify: `index.html`
- Modify: `package.json`

- [ ] **Step 1: 添加 app 协调层的可测试接口**

将 `app.js` 中的 DOM 无关逻辑抽入 `print-workflow.js`，并先创建 `test/print-workflow.test.js`。测试以下行为：A4 不适配时不调用 `window.print`；确认 A3 后使用 `A3 landscape`；加载失败时 `canPrint` 为 `false`；尾页拥有汇总标记。

- [ ] **Step 2: 运行失败测试**

Run: `node --test test/print-workflow.test.js`

Expected: FAIL，提示找不到 `../print-workflow`。

- [ ] **Step 3: 实现 `print-workflow.js`**

模块组合 `loadAllSalaryRows`、`evaluatePaperFit`、`paginatePrintRows`：

```javascript
async function preparePrintDocument(input) {
  const loaded = await loadAllSalaryRows(input.loader);
  const fit = evaluatePaperFit({ paper: input.paper, columns: input.columns.filter((column) => column.printFlag) });
  if (fit.status !== "fit") return { canPrint: false, fit, loaded };
  const pages = paginatePrintRows({ rows: loaded.records, layout: derivePageCapacity(fit.paper, fit.fontPt) });
  return { canPrint: true, fit, pages, loaded };
}
```

`app.js` 使用该工作流：查询后更新摘要，显示顺序加载进度；纸张不足显示“切换并继续”和“返回调整列”；只有 `canPrint` 时启用打印按钮。

- [ ] **Step 4: 生成物理页 DOM 和 CSS**

每页使用 `<section class="print-page print-page--first|middle|last">`，包含各自页头、表格、页脚。CSS 用 `break-after: page` 和 `@page { size: var(--print-size); margin: 9mm; }`；屏幕预览显示页间距，打印时移除工作台控件。最后页 `.print-summary` 和 `.signature` 不允许分页。

- [ ] **Step 5: 执行测试与语法检查**

Run: `npm test && npm run check`

Expected: 全部测试通过，`check` 覆盖新增 `print-layout.js`、`salary-data-loader.js`、`print-workflow.js`。

- [ ] **Step 6: 提交打印管线**

```powershell
git add app.js app.css index.html package.json print-workflow.js test/print-workflow.test.js
git commit -m "feat: render adaptive paginated salary print documents"
```

### Task 6: 更新文档、完整验证和发布准备

**Files:**
- Modify: `README.md`
- Modify: `srcdoc-manifest.template.json`
- Create: `docs/superpowers/specs/2026-07-13-salary-print-pagination-design.md`

- [ ] **Step 1: 迁入已批准设计规格并更新 README**

README 说明：100 条顺序批次、首页/续页/尾页、A4/A3 提示策略、6.5pt 下限、默认 9mm 边距、默认浏览器打印对话框需保持 100% 缩放和默认边距。

- [ ] **Step 2: 更新 srcdoc 资源清单**

按依赖顺序加入 `salary-data-loader.js`、`print-layout.js` 和 `print-workflow.js`，保持稳定文件名，仍使用不可变 Git tag/commit 占位符。

- [ ] **Step 3: 执行全量验证**

Run: `npm test && npm run check`

Expected: 0 failures、0 syntax errors。

- [ ] **Step 4: 提交文档与资源清单**

```powershell
git add README.md srcdoc-manifest.template.json docs/superpowers/specs/2026-07-13-salary-print-pagination-design.md
git commit -m "docs: describe adaptive salary print behavior"
```

## Plan Self-Review

- 规格覆盖：FR-001 对应 Task 3/5；FR-002、FR-003 对应 Task 2/5；FR-004、FR-005、FR-006 对应 Task 2/4/5；所有 NFR 在 Task 3、Task 5、Task 6 有明确验证。
- 类型一致性：`printFlag`、`minWidthMm`、`fit.status`、`pages` 和 `canPrint` 在各任务中使用同一名称。
- 占位符检查：计划没有未定义的实现任务；不可变资源 tag 仅为发布时的受控配置值，不是实现占位符。
