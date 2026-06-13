# AI Prompt Manager v2.0 — AI 功能迭代规划方案

> 版本：v2.0-plan / 2026-06
> 基于行业专家评审意见修订

---

## 一、产品定位与演进路径

### 定位：智能 Prompt 工作台

本方案源自行业专家对 v1.0 的完整评审，综合了 2026 年 Prompt Management 行业分析报告、Gartner 最新观点以及主流平台（Maxim AI、Langfuse、Humanloop、PromptLayer）的最佳实践后对齐修正。

```
v1.0                    v2.0                     v2.x+                    远期
  |                        |                        |                        |
  ▼                        ▼                        ▼                        ▼
结构化笔记本  →  AI 辅助的 Prompt 协作者  →  Prompt 效果实验平台  →  轻量 Agent 工作台
(纯管理)         (管理 + 创作 + 评估)       (管理 + 创作 + 度量)    (编排 + 执行 + 度量)
```

保持核心定位不变：**Prompt 全生命周期管理**，AI 是增强而不是重新定义产品。不做 Dify/Coze 那样的重型 Agent 平台，聚焦"帮你写出更好 Prompt"这个核心价值。

### 竞品定位

| 竞品 | 定位 | 与我们的关系 |
|------|------|-------------|
| Maxim AI | 企业级全生命周期（评估+模拟+监控） | 太重大，目标用户不同 |
| Langfuse | 开源 LLM Ops（追踪+评估+Prompt 管理） | 开发者向，有重叠，但我们是纯本地 |
| Humanloop | 质量门禁的 Prompt 发布 | 强在团队协作，个人用太重 |
| PromptLayer | 非开发者友好的 Prompt 管理 | 靠 proxy 拦截，架构不同 |
| TypingMind / ChatGPT Next | AI 对话客户端 | 只解决"对话"不解决"管理" |
| AIPRM | 浏览器扩展（场景化模板） | 功能浅，不管理版本 |

**AI Prompt Manager 的独特位置**：唯一一个**纯本地、带完整版本管理、具备 AI 辅助能力**的个人 Prompt 工作台。

---

## 二、专家评审核心发现

### 2.1 当前方案的优势

行业专家对齐确认：三级资产结构（场景→提示词→版本）本质上优于大多数个人工具。定位"个人 Prompt 工作台"而非重型企业平台，在 2026 年市场格局下是正确的——企业级市场（Dify、Maxim AI、Langfuse）已拥挤，但轻量级个人工具有真实空白。

### 2.2 关键差距与修正

2026 年 Prompt Management 行业标准能力模型（Gartner / Maxim AI 框架）：

```
版本历史  →  质量评估  →  团队协作  →  阶段发布  →  生产监控
   ✅         ❌           ❌          ❌          ❌
  (已有)      (缺少)      (个人工具)   (缺少)      (缺少)
```

**核心发现**：v2.0 需要补齐"质量评估（Evaluation）"这个维度，才能形成管理闭环。

> *"Prompts that isolate versioning from quality testing force teams to work blind."* — Maxim AI / DEV analysis, 2026

### 2.3 范围控制建议

> *"Start with the audit. Then pick your wedge. What's the most painful problem your team faces right now? Solve that one problem first. Build momentum. Expand from there."* — Promptsy Blog, Jan 2026

专家建议严格控制 v2.0 范围，把资源集中在用户价值最高、改动最集中的功能上。

### 2.4 语义搜索降级建议

原方案把语义搜索列为 P0，专家建议调整为 P1-P2：

- Transformers.js 80MB 模型首次下载影响用户体验
- 个人场景下 Prompt 数量通常在几十到几百条，当前关键词搜索 + 标签筛选已可用
- 替代方案：用 AI API 做搜索增强（用户搜索时 AI 理解语义），而非本地跑 embedding

---

## 三、修正后的功能规划

### v2.0 核心（P0）

| # | 功能 | 用户价值 | 开发成本 | 说明 |
|---|------|---------|---------|------|
| 1 | **Provider 抽象层 + API Key 管理** | 基础设施 | 中 | 插件化设计，支持 OpenAI / Anthropic 等多 provider |
| 2 | **模板变量系统** | ⭐⭐⭐ | 低 | 纯前端实现，`{{变量}}` 检测 + 表单填充 + 实时预览 |
| 3 | **AI 优化建议（内联 diff 视图）** | ⭐⭐⭐ | 中 | 选中内容 → AI 优化 → diff 展示 → 一键采纳 |
| 4 | **内置测试面板** | ⭐⭐⭐ | 中 | 在工具内直接调 API，输入变量值，查看 LLM 输出 |
| 5 | **效果评分** | ⭐⭐ | 低 | Version 增加 score 字段，1-5 星 + 备注，评分排序 |
| 6 | **数据模型扩展** | 基础设施 | 低 | variables, score, testOutput 字段补充 |

### v2.x 扩展（P1-P2）

| # | 功能 | 优先级 | 说明 |
|---|------|--------|------|
| 7 | AI 生成 Prompt | P1 | 用户描述需求，AI 生成候选草稿，一键采纳 |
| 8 | 自动打标签 | P1 | 保存时基于内容推荐标签 |
| 9 | 阶段状态标记 | P1 | Version 增加 draft → testing → stable 状态流转 |
| 10 | 语义搜索 / AI 搜索增强 | P2 | 轻量方案：用 AI API 理解搜索意图，而非本地 embedding |
| 11 | 跨模型对比 | P2 | 同一 Prompt 在多个模型下的输出并列对比 |
| 12 | 导出为 Agent 工具配置 | P2 | 从 Prompt 导出 OpenAI function calling 格式 |

### 远期愿景

| 功能 | 说明 |
|------|------|
| Agent Workflow 编排 | 多 Prompt 串联 + 变量映射 |
| 对话历史导入 | 从 ChatGPT/Claude 导出 JSON，AI 分析提炼 Prompt |
| Prompt 市场 | 匿名分享模板，社区评分 |
| 多设备同步 | CRDT 私有同步（不上云） |
| 团队协作 | 共享空间 + 评论 + 审批 |

---

## 四、核心功能详述

### 4.1 模板变量系统

这是整个 v2.0 的基石，不仅是 UX 提升，更是未来 Agent 能力的数据基础。

**具体应用场景**：

| 场景 | 变量示例 | 价值 |
|------|---------|------|
| 翻译 | `{语言A}`, `{语言B}`, `{语气}`, `{content}` | 一个模板覆盖所有翻译方向 |
| 文案生成 | `{角色}`, `{主题}`, `{平台}`, `{语气}`, `{字数}` | 同一模板用于不同客户/平台 |
| 代码审查 | `{语言}`, `{审查重点}`, `{code}` | 每次粘贴代码 + 选重点即可 |
| 客服回复 | `{公司名称}`, `{会员等级}`, `{用户问题}` | 客服人员填变量即用 |
| 教学出题 | `{科目}`, `{年级}`, `{知识点}`, `{难度}` | 一个模板生成大量差异化内容 |

**交互设计**：

```
┌──────────────────────────────────────┐
│  Prompt 编辑器                        │
│                                      │
│  你是一个{语气}的{角色}，请撰写关于    │
│  {主题}的公众号文章。                    │
│                                      │
├──────────────────────────────────────┤
│  ▼ 变量填充（预览）                    │
│                                      │
│  语气：  [正式/轻松/幽默]              │
│  角色：  [品牌创始人]                  │
│  主题：  [AI 对教育行业的影响]          │
│                                      │
│  ┌── 实时预览 ──────────────────┐    │
│  │ 你是一个正式的、品牌创始人的    │    │
│  │ 角色，请撰写关于 AI 对教育     │    │
│  │ 行业的影响的公众号文章。       │    │
│  └──────────────────────────────┘    │
│                                      │
│  [复制完整内容]  [测试]  [保存版本]     │
└──────────────────────────────────────┘
```

**远期价值**：变量系统 = Prompt 作为函数调用。未来 Agent 模式下，AI 自动检测用户需求 → 自动填充变量 → 调用 Prompt 完成任务，这是 Agent 架构的数据基础。

### 4.2 AI 优化建议

- 用户在编辑器中选中内容或点击"AI 优化"按钮
- 调用 AI API 分析并生成优化建议
- 以 diff 视图（复用现有 VersionDiff 组件）嵌入编辑器下方，高亮新增/删除
- 用户选择"接受"或"忽略"
- 接受后自动生成新版本

### 4.3 内置测试面板

- 解决当前"编辑→复制→切页面→粘贴→测试→切回来→手动记录"的断点
- 测试面板在工具右侧展开
- 用户填入变量值（如有），点击"运行测试"
- 调用 AI API，流式展示输出结果
- 测试后可为该版本评分，记录测试输出到 Version

### 4.4 效果评分

- 每个 Version 新增 score 字段（1-5 星）
- 测试后或手动可评分
- 版本列表按评分排序，高评分版本置顶
- 评分变化趋势在版本历史中可见

---

## 五、数据模型扩展

```typescript
// Prompt 新增字段
variables: string[]       // 模板变量列表 ["language", "tone", "topic"]
embedding?: Float64Array  // 语义搜索向量（预留，v2.x 使用）

// Version 新增字段
score?: number            // 1-5 效果评分
testOutput?: string       // 测试时的 LLM 输出
modelInfo?: string        // 测试使用的模型标识 ("gpt-4o" | "claude-sonnet-4" ...)
status?: 'draft' | 'testing' | 'stable'  // 阶段状态（v2.x）

// 新增 Conversation 表
interface Conversation {
  id: string
  promptId: string        // 关联 Prompt
  messages: Message[]
  tokensUsed: number
  createdAt: number
}
```

---

## 六、架构演进（三阶段）

### 第一期：纯前端 AI 增强（无后端改动）

API Key 管理：用户自备 → 存 localStorage。前端直连 OpenAI/Anthropic API（CORS 允许），与 TypingMind、ChatGPT Next 等工具一致的可接受风险。

```
新增:
  src/services/aiService.ts        — AI API 调用封装 + Provider 抽象层
  src/components/ai/AIAssistant.tsx — AI 优化 / 生成面板
  src/components/ai/TestPanel.tsx   — 内置测试面板
  src/components/ai/VariableForm.tsx— 变量填充表单
  src/hooks/useAIStream.ts         — SSE 流式处理 Hook
  src/hooks/useVariables.ts        — 变量检测 Hook
  src/types/ai.ts                  — AI 相关类型定义

修改:
  src/components/prompt/PromptEditor.tsx  — 添加 AI 工具栏、变量检测
  src/components/version/VersionList.tsx  — 评分展示与排序
  src/db/index.ts                         — 数据模型扩展
  src/pages/PromptDetailPage.tsx          — 整合测试面板
```

### 第二期：轻量后端代理（按需上线）

```
新增 server/ 目录: Hono 4KB 极轻量后端
  - SSE 流式转发
  - API Key 服务端管理（环境变量）
  - 用量统计与限流

Docker 扩展: docker-compose 双容器（nginx + api-proxy）
nginx 新增 /api/ 反向代理
```

### 第三期：Agent + 协作（完整形态）

- 多模型支持（OpenAI、Anthropic、Gemini、本地 Ollama）
- Prompt 自动优化：Agent 分析使用频率 + 评分趋势，主动建议优化
- 团队协作：Prompt 分享 + 评论 + 审批流
- 用量仪表盘：可视化 Token 消耗、各模型花费、Prompt 热度分析

---

## 七、交互设计原则

所有 AI 功能遵循以下体验规则：

1. **按需触发** — 无静默 AI 调用，所有操作都有明确的用户入口
2. **不打断编辑** — AI 结果以 diff 视图嵌入编辑器下方，而非弹窗
3. **接受/拒绝** — 所有 AI 生成内容必须用户确认后才能替换原文
4. **渐进式展示** — 无 API Key 时 AI 按钮灰显 + tooltip 提示，不强制配置
5. **加载可见** — 超过 3 秒显示进度条，流式输出逐字渲染

AI 面板入口位置：

| 位置 | 功能入口 |
|------|---------|
| Prompt 编辑器顶部工具栏 | `[AI 优化] [填充变量] [运行测试]` |
| 右侧抽屉面板 | AI 生成 Prompt（从描述生成草稿） |
| Header 齿轮菜单 | API Key 配置 |
| 首次使用 | Banner 提示"启用 AI 功能需要配置 API Key" |

---

## 八、推荐开发计划

| 阶段 | 内容 | 预计周期 |
|------|------|---------|
| **第 1 周** | Provider 抽象层 + AI Service + API Key 配置页 + 数据模型扩展 | 基础设施 |
| **第 2 周** | 模板变量系统（检测 + 表单 + 实时预览） + AI 优化建议（内联 diff） | 核心功能 |
| **第 3 周** | 内置测试面板 + 效果评分 + E2E 测试覆盖 | 闭环功能 |
| **后续** | 根据用户反馈决定 v2.x 优先级 | 迭代 |

---

## 九、商业化思考

### 阶段判断

- **当前（v1.0 ~ v2.0）**：用户价值验证期 — 免费开源，积累口碑
- **v2.0 发布后**：可试探商业化

### 建议路径

| 阶段 | 产品状态 | 商业模式 |
|------|---------|---------|
| 冷启动（当前 ~ v2.0） | 免费开源 | 积累用户 + GitHub Stars |
| 增长期（v2.0 ~ v2.2） | 核心功能免费 + 云能力溢价 | 本地版免费；云端 AI Provider 功能订阅制 |
| 成熟期（v2.x+） | 个人免费 + 专业付费 | 个人版功能足够；专业版解锁 A/B 测试、多设备同步 |
| 企业 | 私有部署 + 团队协作 | 企业版 = 专业版 + SSO + 团队空间 + 用量报表 |

### 核心原则

- 纯本地功能永远免费
- API 密钥管理 + 云端分析是自然的付费点
- 维持开源，让用户自发传播

---

## 十、附录：方案变更记录

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1 | 2026-06 | 初始方案（三个子智能体并行产出） |
| v2 | 2026-06 | 行业专家评审后修正：模板变量提升至 P0、语义搜索降级至 P2、新增内置测试面板和效果评分、新增 Evaluation 维度 |
