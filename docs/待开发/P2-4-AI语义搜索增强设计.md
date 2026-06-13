# P2-4：语义搜索 / AI 搜索增强

> 摘自 v2.0-P2 详细开发计划 Step 13 | 2026-06-09

## Context

增强现有关键词搜索：用户输入搜索词后，除关键词匹配外，额外使用 AI 理解搜索意图，扩展搜索结果。不替换现有搜索，而是在搜索结果下方增加"AI 推荐"区域。

依赖 P0 的 AI Provider 和 API Key 配置。

## 当前状态

现有搜索为纯关键词匹配（`searchPrompts()` → Dexie `name`/`content` 字段 `.includes()` 模糊匹配）。无语义理解能力。

## 目标行为

1. 用户输入搜索词 → 立即关键词搜索（现有行为不变）
2. 关键词结果不足时（< 10 条），搜索暂停 1.5 秒后触发 AI 语义搜索
3. AI 返回 1-3 个语义相关结果 + 推荐理由
4. 结果以独立"AI 推荐"区域展示在关键词结果下方
5. 限流策略确保不浪费 token

## 涉及文件

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新增 | `src/services/ai/search.ts` | AI 语义搜索逻辑 |
| 新增 | `src/components/ai/AISearchResult.tsx` | AI 搜索结果展示 |
| 修改 | `src/components/search/FilterBar.tsx` | 集成 AI 搜索增强 |
| 修改 | `src/pages/HomePage.tsx` | 状态管理支持 AI 搜索 |

## 实现方案

### 1. AI 搜索 Service — `src/services/ai/search.ts`

核心函数 `aiEnhancedSearch(query)`：

1. `searchPrompts(query)` → 关键词结果
2. 短路检查：结果 ≥ 10 || query < 4 字符 → 返回（不触发 AI）
3. `getAllPrompts()` → 排除已有结果 → 截取前 20 条候选
4. 构建 system prompt：让 AI 从候选中选择 1-3 个最相关的
5. `provider.chat()` → 解析 AI 返回的 `ID|推荐理由` 格式
6. 返回 `{ keywordResults, aiSuggestions }`

```typescript
export interface AISearchResult {
  prompt: Prompt;
  reason: string;
  matchType: 'keyword' | 'semantic' | 'related';
}
```

### 2. AISearchResult 组件

```
搜索结果（现有关键词匹配）保持不变。

新增区域（仅在 AI 有推荐结果时显示）：
┌────────────────────────────────────────────┐
│  🔍 AI 推荐                                 │
│                                            │
│  您是不是在找：                              │
│                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 翻译助手  │  │ 文案优化  │  │ 邮件生成  │ │
│  │ 语义匹配  │  │ 相近场景  │  │ 相关推荐  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────┘
```

Props:
```typescript
interface AISearchResultProps {
  suggestions: AISearchResult[];
  onPromptClick: (id: string) => void;
}
```

### 3. FilterBar 集成

```tsx
{aiSuggestions && aiSuggestions.length > 0 && (
  <div className="mt-3 pt-3 border-t border-dashed">
    <div className="flex items-center gap-1.5 mb-2">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-medium text-primary">AI 推荐</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {aiSuggestions.map((s) => (
        <button key={s.prompt.id} onClick={() => onAIClick?.(s.prompt.id)}
          className="group text-left p-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors max-w-[200px]">
          <div className="text-xs font-medium truncate">{s.prompt.name}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{s.reason}</div>
        </button>
      ))}
    </div>
  </div>
)}
```

### 4. 防抖触发逻辑（Header.tsx）

```
用户输入搜索词
       ↓
0ms:   关键词搜索立即执行（现有行为）
1500ms: 搜索暂停后触发 AI 搜索增强
  → 获取全量 Prompt
  → 排除已在关键词结果中的
  → 截取前 20 条候选
  → 调用 AI API 理解搜索意图
  → AI 返回 1-3 个语义相关结果 + 推荐理由

关键词结果正常展示
AI 推荐以虚线分隔区域展示在下方
用户点击 AI 推荐 → 进入对应 Prompt 详情
```

### 5. 限流策略

| 条件 | 行为 |
|------|------|
| 关键词结果 ≥ 10 | 不触发 AI（已有足够结果） |
| 搜索词 < 4 字符 | 不触发（信息量不足） |
| 候选 Prompt > 50 | 不触发（token 消耗太大） |
| 候选 Prompt = 0 | 不触发（没什么可推荐的） |
| 两次搜索间隔 < 30s | 不触发（防连续调用浪费） |
| AI 未配置 | 不触发（静默跳过） |

## 文件变更

| 文件 | 改动 |
|------|------|
| `src/services/ai/search.ts` | **新建** — AI 语义搜索逻辑（~80 行） |
| `src/components/ai/AISearchResult.tsx` | **新建** — AI 搜索结果展示组件 |
| `src/components/search/FilterBar.tsx` | 新增 `aiSuggestions`/`onAIClick` props + AI 推荐区域 |
| `src/pages/HomePage.tsx` | AI 搜索状态管理 + 防抖逻辑 |
| `src/components/layout/Header.tsx` | 搜索输入防抖 + `setAiSuggestions` |

## 依赖

- 复用 P0 的 `openai` / `@anthropic-ai/sdk`（AI Provider）
- 不新增 npm 包

## 验证

1. 输入短搜索词（< 4 字符）→ AI 搜索不触发
2. 输入搜索词且结果 ≥ 10 → AI 搜索不触发
3. 输入搜索词且结果 < 10 → 1.5s 后 AI 推荐区域出现
4. AI 未配置 → 静默跳过，关键词搜索正常工作
5. 点击 AI 推荐卡片 → 跳转到对应 Prompt 详情
6. 两次快速搜索 → 第二次不触发 AI（30s 限流）
