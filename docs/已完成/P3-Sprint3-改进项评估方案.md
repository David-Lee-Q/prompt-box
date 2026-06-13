# Sprint 3 改进项评估方案

> 来源: P3 全栈代码审查 | 18 项 | 日期: 2026-06-12

---

## 逐项评估

### #17 Nginx 安全头不足

**投入**: 低（1 个文件，5 行）
**收益**: 中（生产环境安全合规）
**影响**: 仅 Docker/nginx 部署，不影响扩展
**风险**: 极低（纯增补响应头，不影响功能）
**详细方案**: `nginx.conf` 的 `server` 块增加：
```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

---

### #18 `.dockerignore` 缺失

**投入**: 极低（1 个新文件，5 行）
**收益**: 高（每次构建减少数百 MB 上下文传输）
**影响**: 仅 Docker 构建，不影响应用
**风险**: 极低
**详细方案**: 根目录创建 `.dockerignore`：
```
node_modules
dist
dist-ext
.git
docs
*.md
```

---

### #19 Service Worker readyTabs 无持久化

**投入**: 中（2 个文件，20 行）
**收益**: 低（SW 重启频率低，用户感知弱）
**影响**: `sw.js` + `insertService.ts`
**风险**: 中（SW 状态管理复杂，可能引入新竞态）
**详细方案**: SW 中监听 `onSuspend` 事件将 `readyTabs` 写入 `chrome.storage.session`，启动时恢复。但 `chrome.storage.session` 仅在 MV3 可用且需要 `storage` 权限。

**建议**: 暂缓。当前 `isTabReady` fallback 机制（轮询 12s 后直接尝试）已足够。

---

### #20 AISettings 添加/编辑表单重复 id

**投入**: 极低（1 个文件，2 行）
**收益**: 低（DOM 规范合规，无功能影响）
**影响**: 无
**风险**: 极低
**详细方案**: 添加表单 `htmlFor` 加 `add-` 前缀，编辑表单加 `edit-` 前缀区分。

---

### #21 VersionList 加载无错误处理

**投入**: 低（1 个文件，10 行）
**收益**: 中（加载失败时用户有反馈）
**影响**: VersionList 组件
**风险**: 极低
**详细方案**: `loadVersions` 包裹 try/catch，增加 `error` state，UI 显示错误提示 + 重试按钮。

---

### #22 Settings 迁移默认 model 过时

**投入**: 极低（1 个文件，1 行）
**收益**: 低（仅影响旧数据迁移路径，非新用户）
**影响**: settingsStore 迁移逻辑
**风险**: 极低
**详细方案**: `settingsStore.ts` 第 39 行 `'claude-sonnet-4-6'` → `'claude-sonnet-4-6-20250601'` 或更通用的默认值。

---

### #23 TS target 升级 ES2021

**投入**: 极低（1 个文件，1 行）
**收益**: 低（更紧凑的编译输出 + 逻辑赋值语法）
**影响**: 所有构建产物
**风险**: 低（Chrome 88+ 完整支持 ES2021）
**详细方案**: `tsconfig.json` 和 `tsconfig.app.json` 的 `target` 从 `ES2020` 改为 `ES2021`。

---

### #24 场景删除确认逻辑误判

**投入**: 低（1 个文件，3 行）
**收益**: 中（用户不再看到误导性确认弹窗）
**影响**: HomePage `confirmDeleteScene`
**风险**: 极低
**详细方案**: `useAppStore.getState().prompts.length` → 过滤该场景下的 prompts：
```ts
const scenePrompts = useAppStore.getState().prompts.filter(p => p.sceneId === deletingScene.id);
const hasPrompts = scenePrompts.length > 0;
```

---

### #25 变量迁移不持久化

**投入**: 低（1 个文件，3 行）
**收益**: 低（性能优化，用户无感知）
**影响**: `promptService.getPrompt`
**风险**: 极低
**详细方案**: `getPrompt` 中迁移 old format variables 后，加一行 `await db.prompts.update(prompt.id, { variables: prompt.variables })` 回写。

---

### #26 useAIStream 死代码

**投入**: 极低（删除 1 个文件）
**收益**: 低（代码整洁）
**影响**: 无（导入搜索确认无引用）
**风险**: 极低
**详细方案**: 确认无引用后删除 `src/hooks/useAIStream.ts`。

---

### #27 废弃函数 initAI / getAIProvider

**投入**: 中（需确认所有调用方并重构）
**收益**: 中（消除技术债，减少维护负担）
**影响**: `index.ts` + 调用方
**风险**: 中（调用方可能遗漏）
**详细方案**: 
1. `getAIProvider` 仍有 `MultiModelTest` 使用，需改为 `getOrCreateProvider`
2. `initAI` 仍有 `settingsStore` 旧路径使用，确认已迁移后删除

---

### #28 heuristicFindInput 排序优化

**投入**: 极低（1 个文件，3 行）
**收益**: 极低（候选元素通常 <5 个）
**影响**: 无
**风险**: 极低
**详细方案**: map-sort-map 模式：
```ts
const sorted = candidates
  .map(el => ({ el, rect: el.getBoundingClientRect() }))
  .sort((a, b) => b.rect.bottom - a.rect.bottom);
```

---

### #29 API Key 输入框可视切换

**投入**: 低（1 个文件，10 行）
**收益**: 中（UX 改进，用户可检查粘贴的 Key）
**影响**: AISettings 组件
**风险**: 极低
**详细方案**: 添加眼睛图标按钮切换 `type="password"/"text"`。

---

### #30 AbortSignal 不对称

**投入**: 中（openai.ts 需改为手动 signal 管理）
**收益**: 低（当前 OpenAI SDK 原生 signal 调用正常）
**影响**: `openai.ts streamChat`
**风险**: 中（改动 AI 核心流）
**详细方案**: 将 OpenAI `streamChat` 改为和 Anthropic 同模式：手动 `addEventListener('abort')` + cleanup。

**建议**: 暂缓。当前实现工作正常，统一化收益有限。

---

### #31 Registry 重复注册警告

**投入**: 极低（1 个文件，2 行）
**收益**: 极低（开发环境调试辅助）
**影响**: 无
**风险**: 极低
**详细方案**: `registerProvider` 中增加：
```ts
if (import.meta.env.DEV && registry.has(format)) {
  console.warn(`Provider "${format}" is already registered`);
}
```

---

### #32 maxTokens/temperature 死代码

**投入**: 中（涉及 UI 或接口变更）
**收益**: 中（用户可配置高级参数）
**影响**: types/ai.ts + AISettings + 两个 provider
**风险**: 中（接口变更影响下游）
**详细方案**: 方案 A：删除接口字段和 provider 引用（简单，1h）；方案 B：AISettings 增加"高级参数"折叠区（有用，3h）。

---

### #33 TestPanel cleanup 空操作

**投入**: 极低（1 个文件，简化 3 行）
**收益**: 极低（代码整洁）
**影响**: 无
**风险**: 极低

---

### #34 空 API Key 不 trim

**投入**: 极低（1 个文件，1 行）
**收益**: 中（用户不会因为粘贴 Key 时多余空格而困扰）
**影响**: `requireProvider` 函数
**风险**: 极低
**详细方案**: `requireProvider()` 中 `.apiKey` 加 `.trim()`。

---

## 汇总矩阵

| # | 投入 | 收益 | 风险 | 建议 |
|----|------|------|------|------|
| 17 | 低 | 中 | 低 | ✅ 做 |
| 18 | 极低 | 高 | 极低 | ✅ 做 |
| 19 | 中 | 低 | 中 | ⏸️ 不做 |
| 20 | 极低 | 低 | 极低 | ✅ 做 |
| 21 | 低 | 中 | 极低 | ✅ 做 |
| 22 | 极低 | 低 | 极低 | ✅ 做 |
| 23 | 极低 | 低 | 低 | ✅ 做 |
| 24 | 低 | 中 | 极低 | ✅ 做 |
| 25 | 低 | 低 | 极低 | ✅ 做 |
| 26 | 极低 | 低 | 极低 | ✅ 做 |
| 27 | 中 | 中 | 中 | ⏸️ 不做 |
| 28 | 极低 | 极低 | 极低 | ✅ 做 |
| 29 | 低 | 中 | 极低 | ✅ 做 |
| 30 | 中 | 低 | 中 | ⏸️ 不做 |
| 31 | 极低 | 极低 | 极低 | ✅ 做 |
| 32 | 中 | 中 | 中 | ✅ 做（方案 A） |
| 33 | 极低 | 极低 | 极低 | ✅ 做 |
| 34 | 极低 | 中 | 极低 | ✅ 做 |

**做**: 14 项 | **不做**: 4 项（#19 #27 #30 #32 方案B）
