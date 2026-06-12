# 待修复 Bug

> 来源: 2026-06-12 专家审查 | 状态: 待排期

---

## P2 — backlog（边缘场景 / 体验）

| # | 问题 | 影响 | 涉及文件 |
|---|------|------|---------|
| 5 | **TypeError 全捕获掩盖编程 bug** — `mapOpenAIError`/`mapAnthropicError` 把任意 TypeError 都当网络错误处理，真实代码 bug（如 `Cannot read properties of undefined`）被误报为"网络连接失败" | 开发/生产环境中真实 bug 无法发现 | `openai.ts:23-25`, `anthropic.ts:23-25` |
| 7 | **generateCandidates 空响应无检查** — AI 返回空内容或全被思考块过滤后，`parseCandidates` 返回空数组，UI 显示空白 | 用户看到空白内容 | `index.ts:173-187`, `GenerateDialog.tsx` |
| 16 | **无跨标签页 settings 同步** — 一个窗口改配置另一个不知道，仍用旧 provider | 用户可能用旧的 API Key 发出请求 | `settingsStore.ts` |
| 15 | **流中断后部分内容丢失** — 连接断开时已累积的部分内容被遗弃，应保留并提示"响应中断" | 用户丢失已生成的内容 | `openai.ts:73-83`, `anthropic.ts:91-104` |
| 19 | **MultiModelTest 并发 setResults 可能交错** — `Promise.allSettled` 里多个 provider 同时更新同一个数组，极端情况下最后一个 setState 覆盖前面的更新 | 部分结果可能丢失 | `MultiModelTest.tsx:52-77` |

---

## P3 — 改进建议（代码质量 / 打磨）

| # | 问题 | 涉及文件 |
|---|------|---------|
| 10 | API Key 输入框 type=password 但无可视切换按钮 | `AISettings.tsx` |
| 11 | AbortSignal 处理在 OpenAI/Anthropic 间不对称，抽象泄露 | `openai.ts`, `anthropic.ts` |
| 12 | Registry `registerProvider()` 重复注册时无警告（`Map.set` 静默覆盖） | `registry.ts` |
| 13 | `AIProviderConfig` 定义了 maxTokens/temperature 但 UI 从未暴露，死代码 | `types/ai.ts`, `AISettings.tsx` |
| 17 | `current` 模块级可变状态，跨异步操作存在理论竞争风险 | `index.ts:14` |
| 21 | TestPanel cleanup effect 在正常完成场景下做空操作，可简化为仅保留 abort 调用 | `TestPanel.tsx:26-28` |

---

## 第二轮审查新发现（极微边缘情况）

| # | 问题 | 影响 |
|---|------|------|
| N1 | **空 API Key 不 trim** — `requireProvider()` 只检查 falsy，不 trim 空格。用户如果在 Key 前后误加空格，不会被拦截，但实际 API 请求会返回 401/403 | 用户体验差，难以排查 |
| N2 | **AISettings 快速双击测试** — React state 异步更新，在 `testing` 变为 true 前用户点两次按钮，第一次的 testId 被覆盖 → provider 未被 evict（内存泄漏，但量极小） | 极端边缘情况，实际影响可忽略 |
| N3 | **流式 think 块跨 chunk 分割** — 如果 `<\think>` 开标签和 `<\/think>` 闭标签在不同 chunk 中到达，开标签在闭标签到达前的极短时间内会在输出中可见 | 视觉闪现，影响极小，需状态机才能完美解决 |

---

## 修复建议

### P2 修复方案

- **#5**: `TypeError` 检查加 `err.message === 'Failed to fetch'`，其他 TypeError 记录为 `unknown`
- **#7**: `parseCandidates` 返回空时，`GenerateDialog` 显示"AI 未返回有效方案"
- **#16**: `settingsStore` 监听 `window.addEventListener('storage', ...)` 实现跨标签页同步
- **#15**: catch 块中保留已累积文本，设为"中断"状态而非错误
- **#19**: 改用 `useRef` 存储结果数组，或 `setResults(prev => ...)` 的函数式更新确保正确链

### P3 修复方案

- **#10**: 输入框加眼睛图标切换 `type="text"/"password"`
- **#13**: 要么在 AISettings 里加"高级参数"折叠区域（temperature 滑块 + maxTokens 输入），要么从接口和 provider 中删除这两个字段
- **#12**: `registerProvider` 加 `if (registry.has(format)) console.warn(...)`（仅 DEV 模式）
