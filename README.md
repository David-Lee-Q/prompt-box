# AI Prompt Manager

**版本：v2.3.0**

浏览器端 Prompt 全生命周期管理工具。基于 IndexedDB 实现全数据本地落盘，集成 AI 辅助优化和质量分析引擎，从分类归档 → 质量诊断 → AI 优化 → 版本迭代 → 备份流转一站式管理提示词资产。v2.3 新增云端同步：通过账号体系将全量数据备份/恢复到自建同步后端，同一账号跨设备无缝接管。

## 功能特性

### 三级资产管理
- **场景（Scene）** — 一级分类，用颜色和名称区分不同业务领域
- **提示词（Prompt）** — 二级条目，归属场景，支持标签和收藏
- **版本（Version）** — 三级迭代，每次保存自动生成语义化版本号

### 版本管理
- 保存时自动生成版本（patch 级别递增：v1.0.0 → v1.0.1 → ...）
- 内容未变时保存不生成新版本
- **点击版本卡片预览历史内容**（只读模式）
- 版本回滚：更新内容但不生成新版本，避免历史污染
- 版本保护/删除：初始版本不可删除，重要版本可加锁保护
- 版本对比：Inline 和并排两种 diff 模式，高亮新增/删除内容

### AI 辅助（v2.0 新增）
- **多 Provider 配置**：支持 OpenAI 兼容和 Anthropic 兼容 API，可配置多个切换使用
- **AI 生成**：根据需求描述自动生成 2-3 个提示词候选方案
- **AI 优化**：6 种快捷预设 + 5 维度质量诊断联动，流式展示 diff 结果
- **质量分析引擎**：纯本地 5 维度诊断（明确性/可操作性/Token效率/可读性/安全性），加权评分
- **单模型测试**：流式运行提示词，评分保存到版本记录
- **多模型对比**：并行运行多个 Provider，对比延迟和输出
- **Think 块过滤**：自动过滤 DeepSeek R1 等模型的推理标签

### 变量模板（v2.0 新增）
- `{{name}}` 语法，支持 6 种类型：text / textarea / number / boolean / select
- 类型感知的表单控件（数字范围、下拉选项、复选框）
- 实时模板渲染预览

### 多视图切换（v2.0 新增）
- **卡片视图**：响应式网格，适合浏览
- **表格视图**：可排序列（名称/版本/更新时间），适合批量管理
- 视图偏好持久化

### 标签与筛选
- 任意数量标签，输入时自动补全已有标签
- 按标签筛选、按时间范围筛选
- 搜索关键词在结果中高亮显示
- 搜索历史（localStorage 保存最近 10 条）

### 导入导出
- **全量导出/导入**：JSON 格式，包含版本号和时间元数据
- **单场景导出**：导出指定场景及其下所有提示词和版本
- **单提示词导出**：可选是否包含版本历史
- **导入校验**：数据结构完整性检查 + 外键一致性验证
- **冲突处理**：三种策略 — 跳过/覆盖/重命名

### 数据安全
- 每日自动快照（localStorage 保留最近 3 份）
- 存储空间用量监控（超过配额 80% 时预警）
- 导出提醒（超过 7 天未导出时提示）
- 状态栏实时显示存储用量和提示词数量

### 云端同步（v2.3 新增）
- **账号体系**：注册/登录；本地账号仅当前设备有效，云端账号支持跨设备登录
- **跨设备接管**：新设备用同一账号登录后自动恢复云端数据（本地为空时）
- **数据管理页**（`/data`）：本地统计 + 全量 JSON 备份/导入 + 云端上传/恢复，显示云端更新时间
- **冲突处理**：Last-Write-Wins，云端存在更新版本时覆盖需人工确认
- **零依赖同步后端**：Node 原生 HTTP 实现，JSON 文件存储（`server/data/sync-data.json`），可独立部署
- 无同步后端时自动降级为纯本地模式，不影响核心功能

### 移动端体验（v2.3 新增）
- 全局悬浮"+"新建按钮（右下角，适配安全区）
- 未选场景新建时弹出场景选择对话框，选中后直达该场景新建页
- 场景抽屉点选后自动收起；移动端操作按钮常驻可见（规避触屏 hover 误触）

### 用户体验
- 暗色模式（系统检测 + 手动切换，偏好持久化）
- 响应式布局（桌面三栏 → 移动端单栏递进）
- 快捷键：`Ctrl+S` 保存、`Ctrl+F` 搜索、`Ctrl+E` 导出、`Ctrl+D` 删除
- CodeMirror 6 编辑器（Markdown/JSON 语法高亮、行号、暗色主题）
- 自动保存草稿（每 30 秒 + 页面关闭时）
- 删除操作二次确认
- PWA 支持（可安装到桌面，离线可用）

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | React 19 + TypeScript (Strict Mode) |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3 + shadcn/ui |
| 数据库 | Dexie 4 (IndexedDB 封装) |
| 状态管理 | Zustand 5 |
| 路由 | React Router 7 |
| 编辑器 | CodeMirror 6 + @uiw/react-codemirror |
| 差异对比 | diff-match-patch |
| 图标 | Lucide React |
| 同步后端 | Node 18+ 原生 HTTP（零依赖）+ JSON 文件存储 |
| 包管理 | pnpm |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器（前端 :3000 + 云端同步后端 :3001）
pnpm dev

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview
```

浏览器需要支持 IndexedDB（Chrome/Firefox/Edge/Safari 等现代浏览器）。

云端同步功能依赖同步后端（`pnpm dev` 已自动拉起）；单独部署前端静态构建时应用以纯本地模式运行。

## 项目结构

```
├── server/
│   ├── index.mjs      # 云端同步后端（零依赖 Node HTTP 服务，默认 :3001）
│   └── data/          # 云端数据存储（sync-data.json，按用户名键控，不入库）
├── scripts/
│   └── dev.mjs        # 并发拉起前端 + 同步后端
└── src/
    ├── components/
    │   ├── ai/        # AI 功能（OptimizePanel, GenerateDialog, TestPanel, MultiModelTest,
    │   │              #   VariableForm, QualityAnalysisPanel, TagRecommendation, etc.）
    │   ├── auth/      # 认证组件（AuthGuard 登录守卫）
    │   ├── layout/    # 全局布局（Header, Sidebar, MainContent, StatusBar,
    │   │              #   GlobalNewPromptFab, ErrorBoundary, ThemeToggle）
    │   ├── prompt/    # 提示词组件（PromptCard, PromptList, PromptEditor）
    │   ├── scene/     # 场景组件（SceneForm, SceneSelectDialog）
    │   ├── settings/  # 设置组件（AISettings）
    │   ├── version/   # 版本组件（VersionList, VersionDiff）
    │   ├── tag/       # 标签组件（TagInput）
    │   ├── search/    # 搜索组件（FilterBar, HighlightText）
    │   └── ui/        # shadcn/ui 组件
    ├── services/
    │   ├── ai/            # AI Provider 抽象层 + Think 过滤
    │   ├── promptService  # 提示词 CRUD + 搜索 + 标签
    │   ├── sceneService   # 场景 CRUD + 级联删除
    │   ├── versionService # 版本管理 + 回滚 + 保护
    │   ├── promptAnalyzer # 5 维度质量分析引擎
    │   ├── scoreService   # 版本评分
    │   ├── tagSuggest     # 自动标签推荐
    │   └── syncService    # 云端同步客户端（注册/登录/推送/拉取/状态）
    ├── store/             # Zustand 状态管理（useAppStore + settingsStore + authStore + secretStore）
    ├── db/                # Dexie 数据库定义（scenes/prompts/versions 三表）
    ├── types/             # TypeScript 类型定义
    ├── utils/             # 工具函数（version, variables, export-import, diff, snapshot, clipboard, helpers）
    ├── hooks/             # 自定义 Hooks（useTheme, useVariables, useKeyboardShortcuts,
    │                      #   use-new-prompt, use-toast）
    ├── pages/             # 路由页面（HomePage, PromptDetailPage, LoginPage, RegisterPage, DataManagementPage）
    ├── App.tsx            # 路由配置 + 登录守卫 + 全局悬浮按钮 + ErrorBoundary
    ├── main.tsx           # 入口（IndexedDB 检测 + SW 注册）
    └── index.css          # Tailwind 入口 + CSS 变量
```

## 数据模型

### 核心实体关系

```
Scene (1) ──── (N) Prompt (1) ──── (N) Version
```

- **Scene**：场景分类，含名称、描述、颜色、排序权重
- **Prompt**：提示词条目，归属场景，含标签、收藏、备注；`content` 是当前版本的缓存冗余
- **Version**：版本历史，含语义化版本号、完整内容、更新说明、保护标记
- **Account / CloudData**（v2.3）：账号（用户名 + 加盐哈希密码）与云端数据（按用户名键控的全量导出结构 + 更新时间戳）

本地数据存储在浏览器 IndexedDB 中，通过 Dexie 封装操作；长期存档可导出到本地 JSON 文件或备份到云端同步后端。

## 开发指南

### 架构原则

- **数据流向**：DB（Dexie）→ Service（纯数据操作）→ Store（状态同步）→ UI（渲染）
- **Service 层**：只操作 Dexie，不关心 UI 状态，返回原始数据
- **Store 层**：Service 的消费者，不做业务逻辑
- **事务保障**：所有写操作在 Dexie 事务中执行

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 保存当前提示词 |
| `Ctrl+F` | 聚焦搜索框 |
| `Ctrl+E` | 导出数据 / 在详情页复制内容 |
| `Ctrl+D` | 删除当前提示词 |
| `Ctrl+Shift+F` | 聚焦搜索框 |
| `Escape` | 关闭弹窗/返回列表 |

### 部署

构建产物为静态文件，可部署到任意静态托管服务：

```bash
pnpm build  # 输出在 dist/ 目录
```

如需启用云端同步，还需部署同步后端并将前端请求的 `/api/sync` 前缀反向代理到后端（开发环境由 Vite 代理到 `127.0.0.1:3001`，生产环境在 Nginx 等层配置）：

```bash
# 单独启动同步后端（默认端口 3001，可用 SYNC_PORT 覆盖）
node server/index.mjs
```

静态托管 + 纯本地模式（无同步后端）同样可用，账号与数据仅存于浏览器本地。

#### Docker

```bash
docker compose up -d --build
```

访问 `http://localhost:8082`。容器名为 `ai-prompt-manager`。

#### Chrome 扩展

```bash
pnpm build:ext   # 输出在 dist-ext/
```

1. 打开 `chrome://extensions`，开启 **开发者模式**
2. 点击 **加载已解压的扩展程序**，选择 `dist-ext/` 目录
3. 点击工具栏扩展图标，打开独立窗口

扩展模式下 API 请求直连（无 CORS 限制），数据仍存储在浏览器本地。

