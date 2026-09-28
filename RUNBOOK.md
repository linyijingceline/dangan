# 伙伴档案 · 运行说明（RUNBOOK.md）

> 这份文档回答一个问题：**明天打开电脑，我该敲什么命令、点哪里，才能让它跑起来。**
> 最后更新：2026-09-27（Day 7）

---

## 一、一句话架构

网页（静态文件）→ 云函数 `api` → CloudBase PostgreSQL 数据库。
**网页不直接连数据库**，电话和住址永远不会发到普通访客的浏览器里。

| 部分 | 在哪 |
|---|---|
| 源码仓库 | https://github.com/linyijingceline/dangan |
| 线上网址 | https://partner-profile-d0fjkj7a9c4abacc-1495948086.tcloudbaseapp.com/ |
| 云函数地址 | https://partner-profile-d0fjkj7a9c4abacc-1495948086.ap-shanghai.app.tcloudbase.com/api |
| 控制台 | https://tcb.cloud.tencent.com/dev?envId=partner-profile-d0fjkj7a9c4abacc |
| 环境 ID | `partner-profile-d0fjkj7a9c4abacc` |

---

## 二、在本地把页面跑起来（看效果、改样式）

静态页面不能直接双击打开（那样地址是 `file://`，有些请求会被浏览器限制），
**要用一个本地服务器**。任选一种：

### 方式一：Python（推荐，电脑上已有）

```bash
cd C:\Users\lenovo\WorkBuddy\partner-profile
python -m http.server 8000 --bind 127.0.0.1
```

然后浏览器打开 **http://localhost:8000/**

> 停止：在这个窗口按 `Ctrl + C`

### 方式二：Node

```bash
cd C:\Users\lenovo\WorkBuddy\partner-profile
npx serve -l 8000
```

**说明**：本地打开时，页面调用的仍然是线上云函数（地址写在 `js/api.js` 的 `API_BASE` 里），
所以本地看到的数据和线上是同一份。云函数那边已经允许 localhost 跨域访问。

### 2.1 假数据模式（Day 8 加的）

`js/api.js` 顶部有一个开关：

```js
const USE_MOCK = true;   // true = 用本地假数据；false = 走真实云函数
```

- **`true`（当前）**：列表页用 `js/mock-data.js` 里的 6 条假数据渲染，
  不开数据库、不用联网也能调页面
- **`false`**：切回真实接口（第 3 周接真实数据时改成 false）

假数据模式下，列表页顶部会出现一条**状态预览**工具条，可以挨个查看四种页面状态：

| 状态 | 用户看到什么 | 为什么要有 |
|---|---|---|
| 有数据 | 一张张档案卡 | 正常情况 |
| 加载中 | 骨架屏（灰色占位卡片） | 网络慢的时候，别让用户对着白屏发呆 |
| 空列表 | 「还没有人填写」+ 填写入口 | 新项目上线第一天就是这个样子，最容易被漏掉 |
| 加载失败 | 「加载失败」+ 重试按钮 | 出错了要让用户能自己做点什么 |

> 上线前记得把 `USE_MOCK` 改成 `false`，否则线上也会显示假数据。

### 2.2 可复用组件

档案卡片单独抽在 `js/card.js` 里（`ProfileCard.html()` / `ProfileCard.list()` / `ProfileCard.skeleton()`）。
列表页、以后的搜索结果都能直接调用，改样式只改一个地方。

### 2.3 视觉规则（Day 9 定的，改样式前先看这条）

页面"像不像正经产品"，靠的不是灵感，是**一整套不破例的规矩**。目前定了 5 条：

| 规则 | 标准 | 在哪 |
|---|---|---|
| 文字对比度 | 正文 ≥ 4.5:1；13px 以下小字 ≥ 7:1 | `--text` / `--muted` / `--muted-strong` |
| 间距节奏 | 只用 4/8/12/16/24/32/48 这 7 个值 | `--space-1` ~ `--space-7` |
| 圆角 | 卡片 12px、按钮与输入框 8px | `--radius-lg` / `--radius-md` |
| 触控目标 | 手机上可点元素高度 ≥ 44px | `--touch` |
| 对齐 | 头像与正文垂直居中；标签与值两列对齐 | `.person` / `.detail-row` |

**怎么检查自己有没有破规矩：**

1. 在 `css/style.css` 里搜 `px`，凡是间距写死的数字（14px、18px 这种）都应该换成 `--space-*`
2. 对比度可以用在线工具或脚本算，别凭眼睛——浅灰压浅底最容易翻车
3. 手机检查：浏览器按 `F12` → 点左上角的手机图标 → 切到 375px 宽，看有没有横向滚动条
4. 新增卡片/列表时，照 `js/card.js` 顶部那 6 条组件约束写

> 判断标准很简单：**别的地方改了，这里不用跟着改**——说明规则起作用了。

---

## 三、改了代码之后，怎么发布

### 改了网页（html / css / js）

1. 把改动过的文件**重新上传到静态托管**：控制台 → 静态网站托管 → 文件管理 → 上传覆盖
2. 浏览器 `Ctrl + F5` 强刷看效果

### 改了云函数（functions/api-http/index.js）

1. 打开云函数代码编辑器：控制台 → 云函数 → `api` → 函数代码
2. 把 `index.js` 全选替换成新内容 → `Ctrl + S` → 点「**部署**」
3. 部署后自检：浏览器打开函数地址，应看到 `{"ok":true,"msg":"伙伴档案服务运行中"}`

### 改了数据结构（表字段）

在控制台 → 数据库 → SQL 编辑器里执行 `ALTER TABLE`，**改完要同步更新 TECH_DESIGN.md 的字段表**。

### 提交到 GitHub

1. 本地：`git add -A && git commit -m "Day X｜说明"`
2. 双击项目里的 `push-dangan.bat` 推送到 GitHub

---

## 四、云函数需要的环境变量

配置位置：控制台 → 云函数 → `api` → 环境变量。**值只存在云端，不要写进代码、不要发聊天。**

| 变量名 | 含义 |
|---|---|
| `CLOUBASE_API_KEY` | 服务端 API Key（身份是 `service_role`，权限最高的那把钥匙） |
| `ADMIN_PASS` | 管理员口令，用于进管理页、看电话和住址 |
| `CLOUBASE_ENV_ID` | 环境 ID（代码里有默认值，一般不用改） |

> 创建 API Key 的位置：控制台 → 左下角「环境管理」→「API Key 配置」→ **服务端 API Key**。
> ⚠️ 完整 Key **只在创建那一刻显示一次**，关掉就看不到了，只能重新创建一条。

---

## 五、数据库的权限设计（改之前先读这一节）

两层门，缺一不可：

| 层 | 作用 | 现状 |
|---|---|---|
| **GRANT** | 这个角色对这张表有没有操作资格 | `authenticated` 对两张表有增删改查 |
| **RLS** | 有资格之后，能碰到哪些行 | 已启用；给 `authenticated` 建了放行策略，**`anon` 没有任何策略** |

- 匿名身份（`anon`）读不到任何行 —— 这是"电话住址仅管理员可见"的实现基础
- 云函数用的是服务端 Key，身份是 `service_role`
- ⚠️ **千万不要给 `anon` 建策略**，否则任何人都能读走电话和住址

---

## 六、出问题时的排查三步（很管用）

云函数里内置了两个诊断动作，用 POST 调用即可：

```bash
# 1. 我现在是什么身份？（expect: service_role）
curl -X POST <云函数地址> -H "content-type: application/json" -d '{"action":"whoAmI"}'

# 2. 请求头有没有被平台认？（看哪种方式返回 401）
curl -X POST <云函数地址> -H "content-type: application/json" -d '{"action":"probe"}'

# 3. 带 debug 看真实报错
curl -X POST <云函数地址> -H "content-type: application/json" -d '{"action":"listProfiles","debug":true}'
```

**常见症状对照表**

| 现象 | 原因 | 怎么修 |
|---|---|---|
| 页面提示"网络好像不太好" | 浏览器因为跨域拒收了响应 | 检查响应头里 `access-control-allow-origin` 是不是出现了**多个值**（函数里不要再设 CORS 头，网关已经在设） |
| 返回 `未知操作：xxx` | 云函数没部署成功（跑的还是旧代码） | 重新替换 `index.js` 并部署 |
| 报 `permission denied for table ...` | 角色缺表权限 | 给对应角色 `GRANT SELECT, INSERT, UPDATE, DELETE` |
| 读出来是空数组但数据确实在 | 被 RLS 挡住了（没策略） | 检查 `pg_policies`，给正确角色建策略 |
| 管理页提示"口令错误" | 口令不对（这其实是好消息，说明链路通了） | 回忆 `ADMIN_PASS` 的值 |

---

## 七、当前文件都是干什么的

```
partner-profile/
├─ index.html        列表页（首页）
├─ submit.html       填写页（含必填校验与告知文字）
├─ profile.html      详情页（只显示公开信息）
├─ admin.html        管理页（口令进入，可增删改）
├─ css/style.css     统一样式
├─ js/api.js         调云函数的唯一入口（含 API 地址、HTML 转义、日期格式化）
├─ functions/
│  ├─ api-http/      实际在用的云函数（HTTP 型，零依赖）
│  └─ api/           早期的事件函数版，留作参考，未部署
├─ research.md       Day 3 竞品调研
├─ PRD.md            Day 4 需求文档（含 21 条验收标准）
├─ TECH_DESIGN.md    Day 5 技术设计（含数据库权限设计）
├─ RUNBOOK.md        本文件
└─ push-dangan.bat   一键推送到 GitHub
```
