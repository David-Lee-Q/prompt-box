# AI Prompt Manager

**版本：v1.0.0**

纯浏览器本地 Prompt 全生命周期管理工具。基于 IndexedDB 实现全数据本地落盘，从分类归档 → 版本迭代 → 备份流转一站式管理提示词资产，私有数据不上云。

## 功能特性

### 三级资产管理
- **场景（Scene）** — 一级分类，用颜色和名称区分不同业务领域
- **提示词（Prompt）** — 二级条目，归属场景，支持标签和收藏
- **版本（Version）** — 三级迭代，每次保存自动生成语义化版本号

### 版本管理
- 保存时自动生成版本（patch 级别递增：v1.0.0 → v1.0.1 → ...）
- 内容未变时保存不生成新版本
- 版本回滚：更新内容但不生成新版本，避免历史污染
- 版本保护/删除：初始版本不可删除，重要版本可加锁保护
- 版本对比：Inline 和并排两种 diff 模式，高亮新增/删除内容

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
| 包管理 | pnpm |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview
```

浏览器需要支持 IndexedDB（Chrome/Firefox/Edge/Safari 等现代浏览器）。

## 项目结构

```
src/
├── components/
│   ├── layout/        # 全局布局（Header, Sidebar, MainContent, StatusBar, ErrorBoundary, ThemeToggle）
│   ├── scene/         # 场景组件（SceneForm）
│   ├── prompt/        # 提示词组件（PromptCard, PromptList, PromptEditor）
│   ├── version/       # 版本组件（VersionList, VersionDiff）
│   ├── tag/           # 标签组件（TagInput）
│   ├── search/        # 搜索组件（FilterBar, HighlightText）
│   └── ui/            # shadcn/ui 组件（自动生成）
├── services/          # 业务逻辑层（sceneService, promptService, versionService）
├── store/             # Zustand 状态管理（单 Store）
├── db/                # Dexie 数据库定义（scenes/prompts/versions 三表）
├── types/             # TypeScript 类型定义
├── utils/             # 工具函数（version, export-import, diff, snapshot, clipboard, helpers）
├── hooks/             # 自定义 Hooks（useTheme, useKeyboardShortcuts）
├── pages/             # 路由页面（HomePage, PromptDetailPage）
├── App.tsx            # 路由配置 + ErrorBoundary
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

所有数据存储在浏览器 IndexedDB 中，通过 Dexie 封装操作。长期存档依赖导出到本地 JSON 文件。

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

