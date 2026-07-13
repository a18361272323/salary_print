# 工资表工作台视觉改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工资表工作台改造成精密档案室风格的响应式产品界面，并用单月份日历替代文本所属期输入。

**Architecture:** 保留已有工资加载与打印工作流。新增纯函数月份选择器模块，模板输出结构化 Bento 区块，CSS 用本地设计令牌、玻璃卡片、细网格和受控动画实现视觉效果；打印媒体样式保持正式表格输出。

**Tech Stack:** 原生 JavaScript、CSS、自带 `node:test`；不引入 React、Tailwind 运行时、Motion 或 Three.js。

---

### Task 1: 单月份选择器逻辑

**Files:**
- Create: `month-picker.js`
- Create: `test/month-picker.test.js`

- [ ] 先写失败测试：当前月默认值、`YYYYMM` 格式、未来月份禁用、上月导航。
- [ ] 运行 `node --test test/month-picker.test.js`，确认模块缺失。
- [ ] 实现 `toMonthKey(date)`、`shiftMonth(key, delta)`、`canSelectMonth(key, nowKey)` 与 `formatMonthLabel(key)`。
- [ ] 再运行同一测试并提交 `feat: add single month picker logic`。

### Task 2: 工作台模板与交互挂点

**Files:**
- Modify: `workspace-template.js`
- Modify: `test/workspace-template.test.js`

- [ ] 先写失败测试：断言存在 `monthPickerButton`、`monthPickerDialog`、`monthGrid`、`progressBar`、`filterCard`、`summaryCard`、`previewCard`。
- [ ] 运行 `node --test test/workspace-template.test.js`，确认失败。
- [ ] 将筛选、摘要、预览和列配置改为命名 Bento 区块；所属期文本输入替换为只读月份按钮与对话层。
- [ ] 运行模板测试并提交 `feat: add bento workbench structure`。

### Task 3: 视觉系统与减弱动效模式

**Files:**
- Modify: `app.css`

- [ ] 增加墨绿/暖灰/纸张白设计令牌、网格与噪点伪元素、玻璃卡片、6px 圆角、焦点环、空状态、进度条和响应式网格。
- [ ] 增加 `prefers-reduced-motion: reduce`，禁用渐入、悬停位移与背景粒子。
- [ ] 在 `@media print` 中移除所有工作台装饰、卡片背景和动画，只保留打印页内容。
- [ ] 运行 `npm run check` 并提交 `feat: restyle salary print workbench`。

### Task 4: 接入月份选择与加载状态

**Files:**
- Modify: `app.js`
- Modify: `test/month-picker.test.js`

- [ ] 先扩展测试，验证点击上月、选择月份和未来月份拦截。
- [ ] 运行月份测试确认失败。
- [ ] 在 `app.js` 将月份选择器业务值传给现有查询；生成 12 个月网格；同步按钮文案；加载时更新 `progressBar` 宽度并切换忙碌状态。
- [ ] 运行 `npm test && npm run check`；提交 `feat: use calendar month selection in workbench`。

### Task 5: 全量验证与发布

**Files:**
- Modify: `README.md`

- [ ] 说明月选择器、减少动态效果和打印视觉边界。
- [ ] 运行 `npm test && npm run check`，预期零失败。
- [ ] 推送 `main` 并在浏览器进行低开运行时验证前说明仍需目标环境的会话与打印预览检查。
