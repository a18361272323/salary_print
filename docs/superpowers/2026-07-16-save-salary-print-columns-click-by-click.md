# Shape A - low-code contract

# “保存工资表打印列配置”傻瓜式节点配置手册

> 目标：前端只发起一次请求，后端 API 编排校验整份列配置快照，删除当前用户/薪资组/所属期的旧列配置，用 SQL `foreach` 一次批量写入新配置，最后回读并返回实际保存结果。
>
> 使用范围：XFT 开发环境中的 API/业务编排“保存工资表打印列配置”。本文不包含生产发布操作。

## 0. 先看结论

推荐主链路如下：

```text
开始
  → 参数映射
  → 校验并标准化列配置（JS脚本）
  → 读取已有列配置（模型方法/列表查询）
  → 提取旧记录ID（JS脚本）
  → 有旧记录吗（分支）
      ├─ 是 → 替换已有配置（数据库事务）
      │          ├─ 删除已有列配置（模型方法/批量删除）
      │          └─ 批量写入新配置（SQL脚本 + foreach）
      └─ 否 → 首次批量写入（SQL脚本 + foreach）
  → 两条分支汇合
  → 回读保存结果（模型方法/列表查询）
  → 组装最终输出（JS脚本）
  → 结束
```

这是当前画布应配置的主路线：**SQL `foreach` 批量写入**。删除、事务和 SQL 写入均关闭“忽略错误”。有旧记录时，删除和批量 INSERT 必须置于同一个数据库事务；官方规则是其中任一步失败，整组事务失败。

## 1. 已确认事实与仍需调试确认的边界

### 已在当前目标页面确认

- 节点菜单存在：分支、并序、循环、异步、结束、参数映射、API接口、模型方法、SQL脚本、JS脚本、数据库事务、薪福通消息、连接器。
- JS 节点使用 `module.exports = async function fn(state) { ... return state; }` 包装。
- 模型方法选择路径存在：`内置数据库 / 工资表打印列配置 / 列表查询`、`新增`、`批量删除`。
- 批量删除的请求参数名为 `ids`。
- 模型方法节点可配置：节点标题、模型方法、存入变量、过滤空值、请求参数、是否忽略执行错误。
- 当前列表查询使用 `existingRecords` 作为存入变量，并按当前用户、薪资组、所属期、`profile_type=column` 查询。
- 当前目标页面中服务端用户表达式为 `${xcUser.userNo}`。
- 用户已选择当前保存接口采用“模型批量删除 + SQL `foreach` 批量新增”；这是本手册唯一需要落到画布的主链路。
- 官方 SQL 节点使用 MySQL 8.0+ 语法，支持 SELECT、INSERT、UPDATE，不支持 DELETE、DDL、DCL。
- 官方 SQL 动态标签支持 `if`、`choose`、`when`、`otherwise`、`where`、`set`、`foreach`、`bind`；`foreach` 可生成批量 INSERT 的多行 `VALUES`。
- 单个 SQL 节点内部有事务一致性；多个普通编排节点之间没有共同事务一致性。
- 数据库事务节点中的模型/SQL步骤顺序执行，并且全部成功或全部失败；不得用于资金划转或支付操作。

### 必须在调试页确认后才能发布

- 分支布尔条件的编辑器选择方式和日志回显。
- SQL 编辑器中“工资表打印列配置”的物理表名、物理字段名和数据源；不要从模型显示名猜。
- SQL `foreach` 中集合路径实际应填 `validatedColumns` 还是目标编辑器要求的其他路径形式。
- SQL INSERT 节点的影响行数/返回结果形态，以及事务内步骤日志字段。
- 最终调试响应是否将 `xcOutput` 放入响应 `body`。

## 2. 公共输入与输出契约

### inputContract

浏览器请求体直接发送下列对象，不要额外包一层 `{ xcInput: ... }`。

| 字段 | 类型 | 必填 | 示例 | 规则 |
| --- | --- | --- | --- | --- |
| `salaryGroupId` | string | 是 | `group-demo` | 去除首尾空格后不能为空 |
| `salaryCycle` | string | 是 | `202606` | 去除首尾空格后不能为空 |
| `columns` | array | 是 | 见下表 | 至少一项，`columnKey` 不得重复 |

`columns[]`：

| 字段 | 类型 | 必填 | 示例 | 规则 |
| --- | --- | --- | --- | --- |
| `columnKey` | string | 是 | `NETPAY` | 非空且整份快照内唯一 |
| `printFlag` | integer | 是 | `1` | 只能是 `0` 或 `1` |
| `displayOrder` | integer | 是 | `100` | 必须是整数 |
| `topGroup` | string | 否 | `统计` | 空值标准化为空字符串 |
| `secondGroup` | string | 否 | `实发工资` | 空值标准化为空字符串 |
| `totalFlag` | integer | 是 | `1` | 只能是 `0` 或 `1` |

### outputContract

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `savedCount` | integer | 是 | 最终回读到的实际记录数，不是请求数组长度 |
| `records` | array | 是 | 最终回读到的模型记录 |
| `version` | number/string/null | 否 | 当前流程未建立可靠版本号时可以不返回 |

## 3. 节点总表

| node name | node type | configuration | input mapping | output variable | output shape | confirmation state |
| --- | --- | --- | --- | --- | --- | --- |
| 开始 | start | 使用系统开始节点 | 公共请求体进入 `xcInput` | `xcInput` | `{ salaryGroupId, salaryCycle, columns }` | 平台基线已确认 |
| 参数映射 | mapper | 建立三个可视变量 | 见第 4.1 节 | `salaryGroupId`、`salaryCycle`、`columns` | 三个顶层状态变量 | 当前目标页面已确认 |
| 校验并标准化列配置 | script | 粘贴第 4.2 节脚本；忽略错误关闭 | `state.xcInput` | `salaryGroupId`、`salaryCycle`、`validatedColumns`、`columnKeys` | 标准化后的请求字段 | JS 包装已确认；异常形态需调试确认 |
| 读取已有列配置 | model-method | 当前模型选择器绑定 `{listMethodKey}`；过滤空值开；忽略错误关 | 当前用户 + 当前薪资组 + 所属期 + `profile_type=column` | `existingRecords` | 预期 `{ list, total, current, pageSize }` | 中文选择路径已确认；执行 key 由当前选择器绑定；输出形态需调试确认 |
| 提取旧记录ID | script | 粘贴第 4.4 节脚本；忽略错误关闭 | `state.existingRecords` | `oldRecordIds`、`hasOldRecords` | `string[]`/`number[]` + boolean | 脚本逻辑已定义；查询输出需调试确认 |
| 有旧记录吗 | branch | 条件读取 `hasOldRecords` | `hasOldRecords === true` | 无 | 真分支删除；假分支跳过删除 | 分支节点存在；表达式界面需目标流确认 |
| 替换已有配置 | transaction | 真分支内选择目标数据源；依次放 `{batchDeleteMethodKey}` 模型节点和 SQL 写入节点；忽略错误关 | `oldRecordIds`、`validatedColumns` | `replaceResult` | 事务结果 | 全成全败为官方规则；数据源/输出形态需目标回读 |
| 删除已有列配置 | model-method | 事务内选择 `{batchDeleteMethodKey}`；过滤空值开；忽略错误关 | `ids = ${oldRecordIds}` | `deletedRecords` | 模型写入结果 | `ids` 已确认；必须位于事务真分支 |
| 批量写入新配置 | sql-script | 事务内粘贴第 4.7 节 SQL；使用 `foreach` | `validatedColumns` + 当前用户/薪资组/所属期 | `insertResult` | 影响行数或平台返回结果 | SQL能力已确认；表/字段/结果形态需目标回读 |
| 首次批量写入 | sql-script | 假分支粘贴同一份第 4.7 节 SQL | `validatedColumns` + 当前用户/薪资组/所属期 | `insertResult` | 影响行数或平台返回结果 | 单SQL节点一致性已确认；表/字段/结果形态需目标回读 |
| 回读保存结果 | model-method | 复用 `{listMethodKey}` 与首次查询条件 | 当前用户 + 当前薪资组 + 所属期 + `profile_type=column` | `finalRecords` | 预期 `{ list, total, current, pageSize }` | 执行 key 由当前选择器绑定；输出形态需调试确认 |
| 组装最终输出 | script | 粘贴第 4.9 节脚本；忽略错误关闭 | `state.finalRecords` | `xcOutput` | `{ savedCount, records }` | JS 规则已确认；最终 `body` 需调试确认 |
| 结束 | end | 所有分支汇合后连接结束节点 | `state.xcOutput` | 无 | 调用方收到最终响应 | 结束节点已确认 |

## 4. 按顺序配置每个节点

### 4.1 参数映射

1. 点击“开始”下面的加号。
2. 选择“参数映射”。
3. 节点标题填：`参数映射`。
4. 输出参数逐行配置：

| 参数名称 | 参数值 |
| --- | --- |
| `salaryGroupId` | `${xcInput.salaryGroupId}` |
| `salaryCycle` | `${xcInput.salaryCycle}` |
| `columns` | `${xcInput.columns}` |

5. “是否忽略该节点执行错误”保持关闭。

### 4.2 校验并标准化列配置（JS脚本）

1. 在“参数映射”后增加“JS脚本”。
2. 节点标题填：`校验并标准化列配置`。
3. “是否忽略该节点执行错误”保持关闭。
4. 在脚本编辑器粘贴：

```javascript
module.exports = async function fn(state) {
  var input = state.xcInput || {};
  var groupId = input.salaryGroupId;
  var cycle = input.salaryCycle;
  var columns = input.columns;

  if (typeof groupId !== "string" || groupId.trim() === "") {
    throw new Error("salaryGroupId不能为空");
  }
  if (typeof cycle !== "string" || cycle.trim() === "") {
    throw new Error("salaryCycle不能为空");
  }
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("columns不能为空");
  }

  var keys = [];
  var normalized = [];
  for (var i = 0; i < columns.length; i += 1) {
    var column = columns[i] || {};
    var key = column.columnKey;
    var order = Number(column.displayOrder);
    var printFlag = Number(column.printFlag);
    var totalFlag = Number(column.totalFlag);
    var topGroup = "";
    var secondGroup = "";

    if (typeof key !== "string" || key.trim() === "") {
      throw new Error("columnKey不能为空");
    }
    key = key.trim();
    if (keys.indexOf(key) >= 0) {
      throw new Error("columnKey不能重复: " + key);
    }
    if (!isFinite(order) || Math.floor(order) !== order) {
      throw new Error("displayOrder必须为整数: " + key);
    }
    if (printFlag !== 0 && printFlag !== 1) {
      throw new Error("printFlag必须为0或1: " + key);
    }
    if (totalFlag !== 0 && totalFlag !== 1) {
      throw new Error("totalFlag必须为0或1: " + key);
    }
    if (column.topGroup !== null && column.topGroup !== undefined) {
      topGroup = String(column.topGroup);
    }
    if (column.secondGroup !== null && column.secondGroup !== undefined) {
      secondGroup = String(column.secondGroup);
    }

    keys.push(key);
    normalized.push({
      columnKey: key,
      printFlag: printFlag,
      displayOrder: order,
      topGroup: topGroup,
      secondGroup: secondGroup,
      totalFlag: totalFlag
    });
  }

  state.salaryGroupId = groupId.trim();
  state.salaryCycle = cycle.trim();
  state.validatedColumns = normalized;
  state.columnKeys = keys;
  return state;
};
```

这个节点必须位于任何删除或新增之前。它抛错时，后续写节点不应执行。

### 4.3 读取已有列配置（模型方法）

1. 在校验节点后增加“模型方法”。
2. 节点标题填：`读取已有列配置`。
3. 模型方法依次选择：`内置数据库` → `工资表打印列配置` → `列表查询`。
4. 存入变量填：`existingRecords`。
5. “过滤空值”打开。
6. “是否忽略该节点执行错误”关闭。
7. 请求参数配置：

| 参数名称 | 参数值 | 说明 |
| --- | --- | --- |
| `current` | `1` | 第一页 |
| `pageSize` | `200` | 必须覆盖单份工资表的最大列数 |
| `owner_user_no` | `${xcUser.userNo}` | 服务端当前用户，不从前端传入 |
| `profile_type` | `column` | 常量，直接输入 |
| `salary_group_id` | `${salaryGroupId}` | 来自校验节点 |
| `salary_cycle` | `${salaryCycle}` | 来自校验节点 |

不要只按薪资组查询，必须同时带当前用户、所属期和 `profile_type`，否则可能删除其他配置。

### 4.4 提取旧记录ID（JS脚本）

1. 在首次列表查询后增加“JS脚本”。
2. 节点标题填：`提取旧记录ID`。
3. “是否忽略该节点执行错误”关闭。
4. 粘贴：

```javascript
module.exports = async function fn(state) {
  var queryResult = state.existingRecords;
  var rows = [];
  var ids = [];

  if (Array.isArray(queryResult)) {
    rows = queryResult;
  } else if (queryResult && Array.isArray(queryResult.list)) {
    rows = queryResult.list;
  }

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (row && row.id !== null && row.id !== undefined && row.id !== "") {
      ids.push(row.id);
    }
  }

  state.oldRecordIds = ids;
  state.hasOldRecords = ids.length > 0;
  return state;
};
```

### 4.5 有旧记录吗（分支）

1. 在“提取旧记录ID”后增加“分支”。
2. 节点标题填：`有旧记录吗`。
3. 条件来源选择变量 `hasOldRecords`。
4. 真分支：连接第 4.6 节的“替换已有配置”数据库事务节点。
5. 假分支：连接第 4.7 节的“首次批量写入”SQL脚本节点。
6. 在调试日志中必须能看到空旧记录时走假分支。

IF 分支只有布尔值 `true` 才会命中；文本 `"true"` 不算。优先直接使用 `${hasOldRecords}`，如果界面要求显式转换则用 `${TOBOOLEAN(hasOldRecords)}`。分支至少有一个 IF，最多一个 ELSE，且一次只执行一个分支。

### 4.6 真分支：替换已有配置（数据库事务）

#### 4.6.1 新建事务外壳

1. 点击真分支下面的加号，选择“数据库事务”。
2. 节点标题填：`替换已有配置`。
3. 数据源选择“工资表打印列配置”所在的同一个内置数据源；必须与第 4.7 节 SQL 节点相同。
4. 事务内步骤保持顺序执行；不要使用并序、异步或循环。
5. 事务节点及其内部步骤都关闭“是否忽略该节点执行错误”。
6. 如界面有“存入变量”，填 `replaceResult`。

#### 4.6.2 事务第 1 步：删除已有列配置

1. 点击事务内部第一个加号，选择“模型方法”。
2. 节点标题填：`删除已有列配置`。
3. 依次选择：`内置数据库` → `工资表打印列配置` → `批量删除`。
4. 存入变量填：`deletedRecords`。
5. “过滤空值”打开。
6. 请求参数只配置一行：

| 参数名称 | 参数值 |
| --- | --- |
| `ids` | `${oldRecordIds}` |

7. “是否忽略该节点执行错误”关闭。

批量删除只能位于真分支的事务内部。不要把空数组或缺失的 `ids` 交给批量删除；第 2 步必须紧接第 4.7 节的“批量写入新配置”。

### 4.7 批量写入新配置（SQL脚本 + `foreach`）

#### 4.7.1 先读取真实物理标识

1. 真分支：在“替换已有配置”事务内的删除步骤后增加“SQL脚本”，标题填 `批量写入新配置`。
2. 假分支：直接增加“SQL脚本”，标题填 `首次批量写入`。
3. 两个 SQL 节点都选择与目标模型相同的内置数据源。
4. 打开 SQL 编辑器的模型/表/字段选择器，找到“工资表打印列配置”。
5. 将真实物理表名记为 `{salaryPrintColumnTable}`，并逐项核对下面 SQL 的字段标识；选择器值不同就全部替换。
6. 不要把模型中文名称当表名，也不要从别的环境复制表名。

#### 4.7.2 两个 SQL 节点粘贴同一份 SQL

```sql
INSERT INTO {salaryPrintColumnTable} (
  config_scope, owner_user_no, profile_type, salary_group_id, salary_cycle,
  column_key, print_flag, display_order, top_group, second_group, total_flag,
  enabled, column_label_override, vertical_text, align_mode, data_type,
  mask_flag, sort_priority, sort_direction, remark
)
VALUES
<foreach collection="validatedColumns" item="item" separator=",">
  (
    'personal', ${xcUser.userNo}, 'column', ${salaryGroupId}, ${salaryCycle},
    ${item.columnKey}, ${item.printFlag}, ${item.displayOrder},
    ${item.topGroup}, ${item.secondGroup}, ${item.totalFlag},
    1, '', 0, 'center', 'text', 0, 0, 'ascending', ''
  )
</foreach>
```

| 配置项 | 真分支 SQL | 假分支 SQL |
| --- | --- | --- |
| 节点位置 | `替换已有配置`事务内第 2 步 | 分支 ELSE 下第 1 步 |
| 节点标题 | `批量写入新配置` | `首次批量写入` |
| 数据源 | 与模型和事务相同 | 与模型相同 |
| 存入变量 | `insertResult` | `insertResult` |
| 自动分页 | 关闭；INSERT 不分页 | 关闭；INSERT 不分页 |
| 是否忽略错误 | 关闭 | 关闭 |
| 下游节点 | 分支汇合后的“回读保存结果” | 分支汇合后的“回读保存结果” |

如果 SQL 编辑器不接受 `validatedColumns` 或 `${item.field}`，先用两条 `columns` 调试并根据 SQL 节点日志校正集合路径和参数语法；不要静默改写成循环单条新增。官方 `foreach` 支持数组/List/Set/Map，本流程输入的是数组。

#### 4.7.3 宽度字段和回退边界

当前输入不维护 `width_mm`，SQL 暂不写该字段，让数据库默认值生效。若字段选择器显示该物理字段非空且无默认值，先读取目标默认规则，再同步增加字段和每个 VALUES 元组；不要凭经验填数字。

仅当调试日志证明当前 SQL 节点无法绑定数组，才允许回退“循环 + 模型新增”：循环源使用裸变量 `validatedColumns`，项变量 `_item`，索引 `_index`；循环内选择 `内置数据库` → `工资表打印列配置` → `新增`，使用本 SQL 中相同字段映射。此回退不具有本方案真分支的已验证事务原子性，必须重新设计并完成失败注入。

### 4.8 回读保存结果（模型方法）

1. 将真、假分支的 SQL 写入完成出口汇合后增加“模型方法”。
2. 节点标题填：`回读保存结果`。
3. 选择 `内置数据库` → `工资表打印列配置` → `列表查询`。
4. 存入变量填：`finalRecords`。
5. 请求参数与第 4.3 节完全一致。
6. “过滤空值”打开。
7. “是否忽略该节点执行错误”关闭。

回读是业务成功的证据。不要用循环次数或 `SUC0000` 代替回读结果。

### 4.9 组装最终输出（JS脚本）

1. 在回读节点后增加“JS脚本”。
2. 节点标题填：`组装最终输出`。
3. “是否忽略该节点执行错误”关闭。
4. 粘贴：

```javascript
module.exports = async function fn(state) {
  var queryResult = state.finalRecords;
  var rows = [];

  if (Array.isArray(queryResult)) {
    rows = queryResult;
  } else if (queryResult && Array.isArray(queryResult.list)) {
    rows = queryResult.list;
  }

  state.xcOutput = {
    savedCount: rows.length,
    records: rows
  };
  return state;
};
```

5. 将该节点连接到“结束”。

## 5. 节点菜单扫盲

| 节点 | 主要入参/配置 | 主要出参 | 本流程是否使用 | 注意事项 |
| --- | --- | --- | --- | --- |
| 分支 | 条件来源、运算符、真/假路径 | 路由结果 | 是 | 两条路径都必须汇合或明确输出 |
| 并序 | 多条独立子路径 | 多个子路径结果 | 否 | 子路径不能依赖彼此输出 |
| 循环 | 裸数组路径、项变量、索引变量 | 每次迭代上下文 | 仅 SQL 绑定失败时回退 | 默认项 `_item`、索引 `_index`；不作为当前主链路 |
| 异步 | 不依赖主响应的后台子任务 | 不应成为主响应依赖 | 否 | 最终 `xcOutput` 不能依赖异步结果 |
| 结束 | 流程终点 | 无 | 是 | 结束前必须已经写入 `xcOutput` |
| 参数映射 | 源字段到目标字段的浅层映射 | 状态变量 | 是 | 嵌套校验、数组处理改用 JS |
| API接口 | URL、方法、头、查询、请求体、响应适配 | 外部响应变量 | 否 | 密钥和签名应放后端适配器 |
| 模型方法 | 模型、方法、请求参数、存入变量、过滤空值、忽略错误 | 查询或写入结果 | 是 | 中文名称只是选择器显示名，不是可复制的 `methodKey` |
| SQL脚本 | 数据源、SQL、动态参数、输出变量 | 行集或影响行数 | 是 | 使用 MySQL 8.0+；`foreach` 批量 INSERT；不支持 DELETE/DDL/DCL |
| JS脚本 | `state.*` 输入、脚本内容 | 写回 `state.*` | 是 | 使用 `var`、显式空值检查和 `for` 循环 |
| 数据库事务 | 数据源、顺序模型/SQL步骤、输出 | 事务结果 | 是（真分支） | 官方规则为全部成功或全部失败；不得用于资金划转或支付 |
| 薪福通消息 | 消息类型、接收人、消息体 | 发送结果 | 否 | 本流程无消息需求 |
| 连接器 | 连接器、认证、动作、请求/响应映射 | 连接器结果 | 否 | 本流程使用内置模型，不需要连接器 |

## 6. SQL 与数据库事务的关键规则

当前方案的真分支必须为：

```text
替换已有配置（数据库事务）
  1. 删除已有列配置（模型批量删除）
  2. 批量写入新配置（SQL foreach INSERT）
```

事务中的模型/SQL步骤顺序执行，任一步失败时整体失败；不要把分支、并序、异步或循环放进事务。假分支没有旧数据，只执行一个 SQL 批量 INSERT；单个 SQL 节点本身具备事务一致性。

必须在开发环境做失败注入：将 SQL 中一项暂时替换为无效字段或违反约束的值，确认真分支接口失败后旧记录仍完整存在；随后立刻恢复正确 SQL，再执行一次正常请求并回读。不要在生产环境做该测试。

## 7. debugSample

### 正常请求

```json
{
  "salaryGroupId": "group-demo",
  "salaryCycle": "202606",
  "columns": [
    {
      "columnKey": "NETPAY",
      "printFlag": 1,
      "displayOrder": 100,
      "topGroup": "统计",
      "secondGroup": "实发工资",
      "totalFlag": 1
    }
  ]
}
```

预期 `body` 片段：

```json
{
  "savedCount": 1,
  "records": [
    {
      "column_key": "NETPAY",
      "print_flag": 1,
      "display_order": 100
    }
  ]
}
```

### 必测失败样例

1. `salaryGroupId` 为空：校验节点失败，模型记录数不变。
2. 两个元素使用相同 `columnKey`：校验节点失败，模型记录数不变。
3. `printFlag=2`：校验节点失败，模型记录数不变。
4. 查询不到旧记录：走分支假路径，不调用批量删除，单个 SQL 批量写入成功。
5. `columns` 含 3 条：SQL 日志只出现一次 INSERT，参数集合包含全部 3 条，最终回读为 3 条。
6. 在事务内 INSERT 做开发环境失败注入：接口失败，旧记录仍完整存在；恢复正确 SQL 后再次执行成功。
7. 正常保存后：`savedCount` 等于最终回读列表长度，且 `column_key` 集合与请求一致。

## 8. readback checklist

- [ ] API 元数据已回读目标 `{apiKey}`，未把中文 API 名称当作可执行 key。
- [ ] 模型选择器仍显示“工资表打印列配置”。
- [ ] `列表查询`、`批量删除`均从目标模型当前方法列表选择，不手填历史 `methodKey`。
- [ ] 首次列表查询的 `existingRecords` 调试输出包含 `list`，或脚本已按实际输出形态调整。
- [ ] 批量删除调试输入明确包含非空 `ids`。
- [ ] 空旧记录样例不会执行批量删除。
- [ ] 两个 SQL 节点的数据源、物理表名和字段名都从当前 SQL 编辑器选择器读取。
- [ ] SQL 日志显示 `foreach` 接收到全部 `validatedColumns`，一次批量 INSERT 完成。
- [ ] 校验 JS 日志中同时存在 `validatedColumns` 和 `columnKeys`。
- [ ] 任一新增失败时 API 不返回伪成功。
- [ ] 最终回读 `finalRecords` 与目标模型记录一致。
- [ ] 最终 `xcOutput.savedCount` 和 `xcOutput.records` 都存在。
- [ ] 响应 `returnCode=SUC0000` 时仍检查 `body.savedCount` 和 `body.records`。
- [ ] 当前用户权限只允许读写自己的列配置。
- [ ] 未在文档、调试样例或日志中保存 Cookie、Token、真实工资数据。

## 9. data-chain

| data-chain item | contract |
| --- | --- |
| data source owner | XFT 内置模型“工资表打印列配置” |
| request adapter | 浏览器直接发送公共输入对象；编排内部通过 `xcInput` 读取 |
| response adapter | 最终 JS 节点显式写入 `state.xcOutput` |
| row identity | 模型系统 `id`；业务列标识为 `column_key` |
| permission boundary | `owner_user_no` 必须来自服务端 `${xcUser.userNo}`，不接受前端伪造 |
| refresh proof | 写入后再次列表查询，使用 `finalRecords` 作为实际结果 |
| target-page confirmation | 前端一次请求；成功后用返回 `records` 替换本地已确认配置 |

## 10. 发布前核对

| # | 检查项 | 通过条件 |
| --- | --- | --- |
| 1 | 节点顺序 | 校验一定在所有写操作之前 |
| 2 | 查询范围 | 当前用户 + 薪资组 + 所属期 + `profile_type=column` |
| 3 | 空列表 | 不调用空 `ids` 批量删除 |
| 4 | 写错误 | 删除和新增都未开启忽略错误 |
| 5 | 输出 | 最终 JS 显式写 `state.xcOutput` |
| 6 | 业务成功 | 以最终回读为准，不以 `SUC0000` 或循环次数为准 |
| 7 | 分页 | `pageSize` 覆盖最大列数，或已实现分页 |
| 8 | 事务 | 真分支使用数据库事务；失败注入与数据回读证明目标配置正确 |
| 9 | 批量写入 | 主链路使用 SQL `foreach`；循环模型新增仅为 SQL 数组绑定失败时的回退路线 |

## Output Preflight

| # | Scan target | Pattern | Pass? | Evidence pointer |
| --- | --- | --- | --- | --- |
| 1 | 模型表 官方字段类型 列 | 本文不输出新模型设计 | YES | 第 1 节说明使用既有模型 |
| 2 | 模型表表头 | 本文不输出新模型字段表 | YES | 第 1 节说明使用既有模型 |
| 3 | API节点表表头 | 7 个必需列完整 | YES | 第 3 节“节点总表” |
| 4 | API节点表 配置列 | 方法名称仅作为选择路径，不作为 executable key | YES | 第 3、4、8 节 |
| 5 | JS 代码块 | 平台脚本使用 `var`、`state.*`、显式空值检查、`for` | YES | 第 4.2、4.4、4.9 节 |
| 6 | 全文 | 无依赖省略性引用 | YES | 全文 |
| 7 | data-chain 表 | 7 项完整 | YES | 第 9 节 |
| 8 | API 编排区段 | 包含 `debugSample` 与 `readback checklist` | YES | 第 7、8 节 |

## Contract Validation

- validator: passed
- command: `node C:\Users\Administrator\.codex\skills\di-kai-lowcode\scripts\validate-contract-output.mjs --file docs/superpowers/2026-07-16-save-salary-print-columns-click-by-click.md`
- file: `docs/superpowers/2026-07-16-save-salary-print-columns-click-by-click.md`
- result: this exact Markdown file passed local contract validation

## Phase Status

- Phase 2A：本地 Markdown 配置手册已生成。
- Phase 2B：在线画布操作已停止；未暂存、未保存版本、未发布。
- 下一步只需用户按第 4 节配置，并按第 7、8、10 节逐项调试。
