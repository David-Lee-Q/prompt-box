# Changelog

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
