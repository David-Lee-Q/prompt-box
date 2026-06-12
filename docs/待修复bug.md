# 待修复 Bug

> 来源: 2026-06-12 专家审查 | 最后验证: 2026-06-12（交叉比对 P3 计划后）

---

## 验证状态汇总

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ 已修复 | 1 | P2-#19 MultiModelTest 并发 setResults（代码已用函数式 setState） |
| 🔴 仍存在，未被 P3 覆盖 | 11 | 见下方 |
| 🟡 仍存在，已被 P3 覆盖 | 1 | P2-#16 跨标签页同步 → P3 计划 #8 |

---

## P2 — 重要修复（建议纳入下 Sprint）

### P2-#5: TypeError 全捕获掩盖编程 bug

**文件**: `src/services/ai/openai.ts:23-25`, `src/services/ai/anthropic.ts:23-25`  
**状态**: 🔴 仍存在  
**P3 计划覆盖**: ❌ 未覆盖  
**影响**: 真实代码 bug（如 `Cannot read properties of undefined`）被误报为"网络连接失败"，开发排查困难

**建议修复**: 拆分 TypeError 处理：
- `err.message === 'Failed to fetch'` 或 `err instanceof TypeError && err.message.includes('fetch')` → `network`
- 其他 TypeError → `unknown` + `console.error` 输出完整堆栈

### P2-#7: generateCandidates 空响应无检查

**文件**: `src/services/ai/index.ts:178-191`, `src/components/ai/GenerateDialog.tsx`  
**状态**: 🔴 仍存在  
**P3 计划覆盖**: ❌ 未覆盖  
**影响**: AI 返回空内容时 UI 显示空白，用户无反馈

**建议修复**: `parseCandidates` 返回空数组时，`GenerateDialog` 显示"AI 未返回有效方案，请重试"

### P2-#15: 流中断后部分内容丢失

**文件**: `src/services/ai/openai.ts:86-88`, `src/services/ai/anthropic.ts:109-113`  
**状态**: 🔴 仍存在  
**P3 计划覆盖**: ❌ 未覆盖  
**影响**: 连接断开时已累积的部分内容被丢弃，用户丢失已生成内容

**建议修复**: catch 块中保留 `fullText`，设 `error` 状态并附上已生成文本，而非完全丢弃

### P2-#17: `current` 模块级可变状态

**文件**: `src/services/ai/index.ts:14`  
**状态**: 🔴 仍存在  
**P3 计划覆盖**: ❌ 未覆盖  
**影响**: 跨异步操作间可能拿到其他调用方设置的 provider（理论风险）

**建议修复**: 每次请求时从 store 读取 active config 并按需创建 provider，不依赖模块级 `current` 指针

> ⬆️ 原 P3-#17，验证后认为跨异步操作逻辑风险足以升级为 P2

---

## P3 — 改进建议

### P3-#10: API Key 输入框无可视切换

**文件**: `src/components/settings/AISettings.tsx:232, 316`  
**状态**: 🔴 仍存在  
**建议**: 加眼睛图标切换 `type="text"/"password"`

### P3-#11: AbortSignal 处理不对称

**文件**: `src/services/ai/openai.ts`, `src/services/ai/anthropic.ts`  
**状态**: 🔴 仍存在  
**建议**: 统一为 Anthropic 模式（手动管理 signal + abort 事件），或提炼到基类

### P3-#12: Registry 重复注册无警告

**文件**: `src/services/ai/registry.ts:6-8`  
**状态**: 🔴 仍存在  
**建议**: 开发模式下 `if (registry.has(format)) console.warn(...)`

### P3-#13: maxTokens/temperature 死代码

**文件**: `src/types/ai.ts:18-19`, `src/services/ai/openai.ts:67-68`, `src/services/ai/anthropic.ts:56-57`  
**状态**: 🔴 仍存在  
**建议**: 二选一 → 在 AISettings 加"高级参数"折叠区域，或从接口和 provider 中删除

### P3-#21: TestPanel cleanup 空操作

**文件**: `src/components/ai/TestPanel.tsx:27-29`  
**状态**: 🔴 仍存在  
**建议**: 仅保留 abort 调用，不产生功能影响

### N1: 空 API Key 不 trim

**文件**: `src/services/ai/index.ts:89 (requireProvider)`  
**状态**: 🔴 仍存在  
**建议**: `requireProvider()` 中加 `.trim()`，修复成本极低

> ⬆️ 原 N 级，提升为 P3。修复成本 1 行代码，用户困惑（Key 已填却认证失败）

### N3: 流式 think 块跨 chunk 截断

**文件**: `src/services/ai/openai.ts:86-88`, `src/services/ai/anthropic.ts:109-113`, `src/services/ai/thinkFilter.ts`  
**状态**: 🔴 仍存在 — **比原评估更严重**  
**实际影响**: 开标签和闭标签在不同 chunk 时，(1) 开标签视觉闪现；(2) 闭合标签到达后 `cleaned.length < lastCleaned`，导致后续 delta 为空，**流式输出被永久截断**（最终返回值正确，但流式显示中断）

**建议**: 简易状态机——在 `stripThinkBlocks` 层面跟踪"是否处于 think 块内"，增量过滤

> ⬆️ 原 N 级，提升为 P3。流式输出中途截断比"视觉闪现"更严重

---

## 建议纳入 P3 计划的新增项

| 原编号 | 建议 P3 位置 | 严重度 | 标题 |
|--------|------------|--------|------|
| P2-#5 | Sprint 2 | 🟡 重要 | TypeError 拆分处理 |
| P2-#7 | Sprint 2 | 🟡 重要 | generateCandidates 空响应 |
| P2-#15 | Sprint 2 | 🟡 重要 | 流中断保留部分内容 |
| P2-#17 | Sprint 2 | 🟡 重要 | current 模块级状态 |
| P3-#10 | Sprint 3 | 🟢 改进 | API Key 可视切换 |
| P3-#11 | Sprint 3 | 🟢 改进 | AbortSignal 统一 |
| P3-#12 | Sprint 3 | 🟢 改进 | Registry 重复警告 |
| P3-#13 | Sprint 3 | 🟢 改进 | maxTokens 死代码清理 |
| P3-#21 | Sprint 3 | 🟢 改进 | TestPanel cleanup |
| N1 | Sprint 3 | 🟢 改进 | 空 Key trim |
| N3 | Sprint 2 | 🟡 重要 | 流式 think 块跨 chunk 截断 |
