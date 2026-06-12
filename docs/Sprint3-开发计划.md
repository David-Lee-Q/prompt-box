# Sprint 3 开发计划

> 来源: P3 全栈代码审查改进项 | 15 项 | 约 3-4h | 日期: 2026-06-12

---

## 不做 4 项

| # | 项目 | 原因 |
|---|------|------|
| 19 | Service Worker readyTabs 持久化 | 已有 12s 轮询 fallback，SW 重启频率极低 |
| 27 | 废弃函数 initAI / getAIProvider | getAIProvider 被 MultiModelTest 使用且语义不同（每次新建 vs 池缓存） |
| 30 | AbortSignal 不对称 | 均为各自 SDK 正确用法，强行统一增加 OpenAI 侧代码量 |
| 32-B | 高级参数 UI (temperature/maxTokens) | 字段从未赋值，做 UI 是创造需求而非修 bug |

---

## Tier 1 — 用户可感的 Bug 修复

### #24 场景删除确认逻辑误判

**文件**: `src/pages/HomePage.tsx`  
**投入**: 5 分钟 | **收益**: 高  
**问题**: `confirmDeleteScene` 用全局 `prompts.length`（而非该场景下的 prompt 数）判断是否弹警告。用户删除无 prompt 的场景时也会看到"场景下有关联的提示词"误导弹窗。

**修复**:
```ts
const scenePrompts = useAppStore.getState().prompts.filter(p => p.sceneId === deletingScene.id);
const hasPrompts = scenePrompts.length > 0;
```

### #34 空 API Key 不 trim

**文件**: `src/services/ai/index.ts` + `src/components/settings/AISettings.tsx`  
**投入**: 10 分钟 | **收益**: 中  
**问题**: 粘贴 Key 时多余空格（极常见）导致认证失败，用户困惑。需修两处：

1. `requireProvider()` 加 `.trim()`：
```ts
if (!provider.getConfig().apiKey.trim()) throw new AIError('API Key 未设置', 'auth');
```

2. AISettings `handleSave` 中存储前 trim：
```ts
apiKey: form.apiKey.trim(),
```

### #21 VersionList 加载无错误处理

**文件**: `src/components/version/VersionList.tsx`  
**投入**: 15 分钟 | **收益**: 高  
**问题**: `loadVersions` 抛异常后 `loading` 永远为 `true`，组件永久停在"加载中..."。

**修复**: try/catch + error state + 重试按钮：
```ts
const [error, setError] = useState<string | null>(null);
const loadVersions = async () => {
  try { setLoading(true); setError(null); ... }
  catch { setError('加载失败'); }
  finally { setLoading(false); }
};
```

---

## Tier 2 — 快速清理

### #18 .dockerignore 缺失

**文件**: 新建 `.dockerignore`  
**投入**: 2 分钟 | **收益**: 高  
```
node_modules
dist
dist-ext
.git
docs
*.md
.env*
.claude/
.github/
.vscode/
*.log
```

### #26 删除 useAIStream.ts

**文件**: 删除 `src/hooks/useAIStream.ts`  
**投入**: 1 分钟 | **收益**: 低  
**确认**: 全项目无 import 引用，安全删除。

### #20 + #29 合并批次 — AISettings.tsx

**文件**: `src/components/settings/AISettings.tsx`  
**投入**: 15 分钟 | **收益**: 中  
**#20**: 添加/编辑表单 `htmlFor` 加 `add-`/`edit-` 前缀区分  
**#29**: API Key 输入框加眼睛图标切换 `type="password"/"text"`

### #28 heuristicFindInput 排序优化

**文件**: `content-scripts/dom-finders.ts`  
**投入**: 5 分钟 | **收益**: 低  
```ts
// Before: sort 中多次调用 getBoundingClientRect
// After: map-sort-map 一次调用
const sorted = candidates
  .map(el => ({ el, rect: el.getBoundingClientRect() }))
  .sort((a, b) => b.rect.bottom - a.rect.bottom);
const best = sorted[0];
```

### #31 Registry 重复注册警告

**文件**: `src/services/ai/registry.ts`  
**投入**: 2 分钟 | **收益**: 低  
```ts
if (import.meta.env.DEV && registry.has(format)) {
  console.warn(`Provider "${format}" already registered, overwriting`);
}
registry.set(format, factory);
```

### #22 Settings 迁移默认 model 过时

**文件**: `src/store/settingsStore.ts`  
**投入**: 1 分钟 | **收益**: 低  
`'claude-sonnet-4-6'` → `'claude-sonnet-4-6-20250601'`

### #33 TestPanel cleanup 空操作

**文件**: `src/components/ai/TestPanel.tsx`  
**投入**: 2 分钟 | **收益**: 低  
确认为代码整洁项。

---

## Tier 3 — 需验证

### #25 变量迁移持久化

**文件**: `src/services/promptService.ts`  
**投入**: 10 分钟 | **收益**: 低  
`getPrompt` 中迁移 old format variables 后，`await db.prompts.update(prompt.id, { variables })` 回写。

### #23 TS target ES2021（含 lib）

**文件**: `tsconfig.json`  
**投入**: 5 分钟 | **收益**: 低  
```json
"target": "ES2021",
"lib": ["ES2021", "DOM", "DOM.Iterable"],
```
需完整构建验证。

### #17 Nginx 安全头

**文件**: `nginx.conf`  
**投入**: 10 分钟 | **收益**: 中  
```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```
⚠️ 需 Docker 部署验证 CSP 不阻断应用。

### #32-A 删除 maxTokens/temperature 死字段

**文件**: `src/types/ai.ts` + `src/services/ai/openai.ts` + `src/services/ai/anthropic.ts`  
**投入**: 15 分钟 | **收益**: 低  
删除 `AIProviderConfig` 中 `maxTokens?` / `temperature?` 字段，清理 provider 中对应展开逻辑和 `getMaxTokens()`。

---

## 修复顺序

```
Tier 1 (30min):    #24 → #34 → #21
Tier 2 (40min):    #18 → #26 → #20+#29 → #28 → #31 → #22 → #33
Tier 3 (40min):    #25 → #23 → #17 → #32
```

预计总投入约 2 小时，无跨项依赖。
