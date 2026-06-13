# Changelog

## v2.2.0 (2026-06-13)

### 安全加固

- `host_permissions` 从 `<all_urls>` 收缩为 13 个具体域名，自定义 API 域名动态申请
- 快照从 localStorage 迁移至 IndexedDB（Dexie v3），含旧数据自动迁移
- Content Script 消息增加 `sender.id` 校验

### 插入可靠性重写

- Content Script 使用 MutationObserver 等待动态输入框（替代一次性 querySelector）
- Service Worker 监听 CONTENT_SCRIPT_READY 信号，维护就绪状态表
- `chrome.tabs.onUpdated` 替代固定延时等待，已有标签页强制导航到聊天 URL
- Shadow DOM 递归搜索 + 启发式定位（底部最大可见元素）
- 输入事件改用 `InputEvent('insertText', composed: true)` 兼容 React 合成事件

### AI 模型管理增强

- Provider Pool 替代全局单例，支持多 Provider 并行调用
- 统一 `AIError` 错误类型，用户友好错误提示
- testConnection 内置 20s 超时，`savePrompt` 校验 sceneId 有效性
- thinkFilter 扩展至 13 条规则，覆盖未闭合标签
- Anthropic SDK 添加 `thinking: disabled` 从源头禁思考输出
- 流中断时返回已累积内容（非空时）

### 健壮性改进

- `useKeyboardShortcuts` 改为 ref 模式，消除每帧重注册
- `savePrompt` 内容不变时不写 DB 不生成版本
- deleteVersion 添加 Dexie 事务保护，PromptCard 消除 N+1 查询
- 多 Tab 状态同步（storage 事件 + visibilitychange）
- 快照创建加锁防止多窗口并发
- `parseCandidates` 多策略分割适配不同模型输出格式

### 功能改进

- 测试面板输出区域独立滚动 + 超长单词换行，避免内容被截断
- AI 设置对话框滚动优化 + 编辑区表单视觉区分
- 提示词编辑框支持拖拽调整高度（120-1200px）
- 标签推荐移至标签行内单行展示
- API Key 输入框密码可视切换
- 场景删除确认逻辑修正（按场景过滤 prompts 而非全局判断）
- 只读版本显示更新说明
- CodeMirror 字体调大至 14px

### 安全修复

- 移除 `console.log` 暴露 API URL
- 13 个 host_permissions 域名替换 `<all_urls>`
- 测试连接前动态域名权限申请

### 技术变更

- TypeScript target 升级至 ES2021，lib 同步
- 删除未使用死代码（useAIStream、maxTokens/temperature）
- `.dockerignore` 减少 Docker 构建上下文
- Nginx 添加 HSTS/CSP/Permissions-Policy 安全头
- E2E 测试从 41 扩展到 46 个，新增回归测试套件
- 3 轮四路并行专家代码审查 + 安全审查，修复 50+ 项问题

---

## v2.1.0 (2026-06-11)

### Chrome 扩展支持

- 点击扩展图标打开 960×720 独立窗口（单例聚焦）
- 扩展环境 API 直连（`host_permissions` 绕过 CORS，无需代理）
- 双构建命令：`pnpm build`（Web）+ `pnpm build:ext`（扩展），产物隔离
- 搜索框自适应：宽屏内嵌搜索栏，窄屏图标 + 下拉面板
- 扩展图标 16/32/48/128 四尺寸 PNG（SVG 生成脚本）

### 修复

- 主题切换时 CodeMirror 编辑框实时跟随（事件驱动 `useTheme`）
- 深色模式边框对比度优化（`--border` 17.5% → 28%）
- 快捷键空值保护（`e.key || ''`）

### 技术变更

- 新增 `src/utils/env.ts` — 环境检测（`isExtension` / `shouldUseProxy`）
- 新增 `src/hooks/use-theme.ts` — 事件驱动主题同步（CustomEvent）
- 新增 `public-ext/` — 扩展静态资源（manifest、icons、sw.js、theme-init.js）
- 新增 `src/sidepanel.tsx` / `src/options.tsx` — 扩展 TSX 入口
- 新增 `scripts/generate-icons.mjs` — SVG → PNG 图标生成
- `src/App.tsx` 条件路由（HashRouter/BrowserRouter）
- `vite.config.ts` 双模式构建（`mode === 'extension'`）

---

## v2.0.0 (2026-06-10)

### 新增功能

#### AI 辅助
- **多 Provider 配置**：支持 OpenAI 兼容和 Anthropic 兼容 API，可配置多个 Provider 并切换
- **AI 提示词生成**：根据需求描述自动生成 2-3 个候选方案，支持采纳和编辑
- **AI 提示词优化**：6 种快捷预设（提取变量/更具体/更简洁/丰富约束/强化角色/优化结构）+ 5 维度质量诊断联动，流式展示 diff 结果
- **质量分析引擎**：纯本地 5 维度诊断引擎（明确性 30%、可操作性 25%、Token 效率 20%、可读性 15%、安全性 10%），加权评分 + 优先级建议
- **单模型测试**：流式运行提示词，输出保存到版本记录，支持评分
- **多模型对比**：并行运行多个 Provider，对比延迟和输出结果
- **Think 块过滤**：自动过滤 DeepSeek R1 (`<\think>`)、Claude (`<thinking>`)、通用 (`[THINKING]`/`【思考】`) 等 5 种推理标签

#### 变量模板
- `{{name}}` 语法支持 6 种变量类型：text / textarea / number / boolean / select
- 类型感知的表单控件（number 带 min/max、select 下拉选项、boolean 复选框）
- `{{name:number:1,100}}` / `{{lang:select:英文,日文}}` 等内联类型标注语法
- 实时模板渲染预览 + 一键复制渲染结果

#### 版本管理增强
- 点击版本卡片预览历史内容（只读模式，带"返回当前版本"横幅）
- 版本选中态高亮（区别于"当前版本"样式）

#### 多视图切换
- 卡片视图（响应式网格，1/2/3 列）
- 表格视图（可排序列：名称/版本/更新时间，内容预览，标签列）
- 视图偏好持久化到 localStorage

#### 标签增强
- 保存后自动推荐标签（基于关键词匹配 + 已有标签复用）
- 推荐标签可选择性应用，5 秒自动消失

#### 数据管理
- 搜索历史（localStorage 保存最近 10 条，可清除）
- 提示词按场景、标签、日期范围组合筛选
- 每日自动快照上限 3 份

### 修复

- 质量分析引擎：修复中文 `\b` 正则边界问题（JS 不认中文为 `\w`），重写所有 specificity/hasSteps/hasIOBoundary/hasEdgeCases 检测
- 质量分析：移除 `应该`（实为指令非模糊）、`需要`（过于宽泛）等误判关键词
- 质量分析：收紧角色定义检测（移除宽泛的 `作为`/`角色`/`身份`）
- 质量分析：修复 `hasSteps` 中文顿号格式不检测的问题（`1、步骤一`）
- 质量分析：修复 `hasIOBoundary` 单行 I/O 定义不检测的问题
- 质量分析：修复 `savedChars` 算术错误（10 处）
- 质量分析：CJK 长句阈值从 40 提升至 80
- 质量分析：注入检测扣分加上限（50），PII 正则加 `\b`，IP 正则做八位组校验
- AI 优化：重写 system prompt 从机械关键词堆砌改为原则引导 + 诊断参考
- AI 优化：维度勾选/取消时自动注入/清除 findings 到指令输入框
- 表视图：收藏操作不改变排序位置（移除 `updatedAt` 更新）
- Logo 点击返回首页时清除场景筛选

### 技术变更

- 新增 `src/services/promptAnalyzer.ts` — 553 行 5 维度质量分析引擎
- 新增 `src/services/ai/` — AI Provider 抽象层（OpenAI/Anthropic）+ Think 过滤 + CORS 代理
- 新增 `src/store/settingsStore.ts` — AI 设置独立 Store + 3 种旧格式迁移
- 新增 `src/components/ai/` — 14 个 AI 相关组件
- 新增 `src/components/settings/` — AI 设置对话框
- 新增 `src/hooks/useVariables.ts` — 变量提取 + 模板渲染
- 新增 `src/hooks/use-toast.ts` — Toast 通知系统
- 新增 `src/utils/variables.ts` — 类型感知变量解析
- 状态管理从单 Store 拆分为 `useAppStore` + `settingsStore`
- 92 项单元测试（+63 from v1.0.0）
- 4 套 Playwright E2E 测试（35 项）
- Docker 构建（node:22-alpine）+ 容器固定名 + 端口 8082
- 状态栏添加版本号（v2.0.0）+ Builder 署名（dorstar）
- 新增 `docs/chrome-extension-migration-plan.md` — Chrome 扩展改造规划

---

## v1.0.0 (2026-05-14)

### 初始版本

- 场景 CRUD（颜色标记、排序）
- 提示词 CRUD（CodeMirror 6 编辑器、标签、收藏、备注）
- 版本管理（自动 patch 递增、内容未变不生成版本、回滚、保护/删除、diff 对比）
- 标签系统（自动补全、筛选）
- 搜索（名称+内容模糊搜索、关键词高亮）
- 导入导出（全量/场景/提示词三级、JSON 格式、冲突检测三种策略）
- 数据安全（每日快照、存储监控、导出提醒）
- 暗色模式 + 响应式布局 + PWA
- 键盘快捷键（Ctrl+S/F/E/D）
- 草稿自动保存（30s 定时 + beforeunload）
