# AI Prompt Manager 复刻开发规划 v3.0（终版）

**文档版本**：v3.0（经两轮专家评审后修订）
**更新日期**：2026-06-05
**开发模式**：Vibe Coding 纯前端本地优先
**预计总工时**：26-30 小时（分 5-6 个半天完成）
**工时声明**：此为乐观估算，阶段一完成后建议重新校准后续阶段工时

---

## 一、产品核心定位与价值

### 产品定位

**纯浏览器本地 Prompt 全生命周期管理工具**，依托前端 IndexedDB 实现全数据本地落盘，从分类归档→版本迭代→备份流转一站式管理企业/个人提示词资产，私有数据不上云，兼顾安全与协作。

### 解决的核心痛点

1. **资产零散**：提示词四散在 Notion、备忘录、聊天记录，跨软件查找低效
2. **版本丢失**：微调后旧版优质提示词直接覆盖，无法回溯历史好用版本
3. **隐私泄露**：涉密业务 Prompt 存第三方云端，存在业务逻辑泄露风险
4. **复用困难**：优质提示词无法标准化流转，团队经验难以沉淀

### 三大核心护城河

1. **三级精细化资产管理**：场景→提示词→版本，完整覆盖 Prompt 生命周期
2. **绝对本地优先**：数据物理隔离，不经过任何服务器，离线可用
3. **专业版本管理**：自动生成版本、一键回滚、版本对比，这是与记事本类工具的本质区别

---

## 二、技术栈最终选型（零后端依赖）

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| 框架 | React + TypeScript | 19.x / Strict Mode | 类型安全，生态成熟 |
| 构建 | Vite | 6.x | 极速 HMR，零配置 |
| 样式 | Tailwind CSS + shadcn/ui | **3.x（推荐）** | ⚠️ Tailwind v4 当前生态未成熟，shadcn/ui 社区示例多基于 v3。建议使用 v3 降低踩坑风险。待 v4 生态稳定后可升级 |
| 数据库 | Dexie | 4.x | IndexedDB 封装，支持事务和索引 |
| 状态管理 | Zustand | 5.x | 轻量，TS 友好，单 Store + slice 模式 |
| 路由 | React Router | 7.x | 使用声明式 `<BrowserRouter>` + `<Routes>`（`createBrowserRouter` 对小型项目偏重） |
| 差异对比 | diff-match-patch | — | Google 的 diff 算法，输出为 `Diff[]` 格式，需自行实现渲染组件 |
| 图标 | Lucide React | — | 按需加载，Tree-shakable |
| 部署 | Cloudflare Pages / Vercel | — | 推荐 Cloudflare Pages（国内访问更优） |
| 包管理 | pnpm | — | 速度快，磁盘占用低 |

### PWA 说明

**PWA（Progressive Web App）不是"可选功能"，而是本地优先定位的自然延伸。** 考虑到产品核心卖点是"离线可用"和"本地优先"，建议在**阶段二**就完成 PWA 基础配置（manifest.json + Service Worker 缓存），而非推迟到阶段四。这样用户在 MVP 时期就能安装到桌面，提前验证"离线可用"这一核心价值主张。

### 可选依赖（按需引入）

| 依赖 | 用途 | 引入时机 |
|------|------|---------|
| CodeMirror 6 + @uiw/react-codemirror | 代码编辑器（语法高亮+行号） | 阶段三 |
| react-window | 虚拟滚动（提示词列表超过 500 条时启用） | 阶段四（按需） |

---

## 三、数据结构最终设计（核心基石）

### 核心类型定义

```typescript
// 场景表（一级分类）
interface Scene {
  id: string;           // 唯一ID，crypto.randomUUID() 生成
  name: string;         // 场景名称，如"产品需求分析"
  description: string;  // 场景描述
  color: string;        // 左侧边栏图标颜色，如 "#3b82f6"
  icon: string;         // Lucide 图标名称，如 "FileText"
  sortOrder: number;    // 排序权重，越小越靠前
  createdAt: number;
  updatedAt: number;
}

// 提示词表（二级条目）
interface Prompt {
  id: string;
  sceneId: string;           // 所属场景 ID（外键）
  name: string;              // 提示词名称
  content: string;           // 当前版本内容的缓存冗余（提升读性能）
  isStarred: boolean;        // 收藏标记
  currentVersionId: string;  // 当前使用的版本 ID
  tags: string[];            // 标签数组（阶段三启用）
  notes: string;             // 备注说明（阶段三启用）
  createdAt: number;
  updatedAt: number;
}

// 版本历史表（三级迭代）
interface Version {
  id: string;
  promptId: string;       // 所属提示词 ID（外键）
  version: string;        // 语义化版本号，如 "v1.0.6"
  title?: string;         // 版本别名，如"给客服用的精炼版"
  content: string;        // 该版本的完整提示词内容
  changeLog: string;      // 更新说明
  isProtected: boolean;   // 保护版本，防止被误删除
  isInitial: boolean;     // 是否为初始版本（初始版本不可删除）
  createdAt: number;
}

// 版本回滚操作不生成新版本，仅更新 Prompt.currentVersionId

// 导出数据结构
interface ExportData {
  version: string;           // 导出格式版本，如 "1.0"
  exportedAt: string;        // ISO 时间戳
  scenes: Scene[];
  prompts: Prompt[];
  versions: Version[];
}
```

### Dexie 数据库定义

```typescript
// src/db/index.ts
import Dexie, { type EntityTable } from 'dexie';

const db = new Dexie('AIPromptManager') as Dexie & {
  scenes: EntityTable<Scene, 'id'>;
  prompts: EntityTable<Prompt, 'id'>;
  versions: EntityTable<Version, 'id'>;
};

db.version(1).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, createdAt',
});
```

### 设计要点说明

- **Prompt.content 冗余**：是 currentVersion 内容的缓存，提升列表读取性能。通过 `savePrompt` 的事务保证两者一致性
- **tags 用 * 前缀**：Dexie 的多值索引，支持数组字段的过滤查询
- **sortOrder**：场景排序实际需要，MVP 可先默认按 createdAt 排序
- **版本号**：以字符串存储，排序通过 service 层工具函数处理
- **数据迁移**：Dexie 的 `db.version()` 机制确保数据结构升级时数据不丢失
- **isInitial 标记**：区分初始版本和后续版本，初始版本不可删除（替代原版 isProtected 用于初始版本）

---

## 四、分阶段开发路线图（可直接执行）

### 阶段一：MVP 核心功能（12-14 小时，拆为 2 个半天）

**目标**：跑通核心流程，实现产品最小可用版本。**每个子任务完成后建议做一次手动冒烟测试。**

**⚠️ 工时预警**：12-14h 是乐观估算，含冒烟测试后实际可能达 14-16h。如果阶段一超时，**不要压缩测试和校验代码的时间**，宁可延长到第 3 个半天。导入校验和冲突处理是数据安全的底线，不可省略。

#### 1.1 项目初始化与基础设施（1.5 小时）

```bash
# 推荐 pnpm
pnpm create vite@latest ai-prompt-manager -- --template react-ts
cd ai-prompt-manager
pnpm install dexie zustand lucide-react react-router-dom diff-match-patch
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input textarea card scroll-area dialog toast
```

- 配置 Tailwind CSS **v3**（社区文档和 shadcn/ui 示例最成熟）
- 配置 TypeScript Strict Mode
- 配置 React Router（推荐 `<BrowserRouter>` + `<Routes>` 声明式写法）

**⚠️ 新增：IndexedDB 可用性检测**
在 `main.tsx` 入口添加检测：
```typescript
if (!window.indexedDB) {
  document.getElementById('root')!.innerHTML = `
    <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
      <h1>浏览器不支持</h1>
      <p>当前浏览器不支持 IndexedDB，请使用现代浏览器（Chrome/Firefox/Edge/Safari）访问。</p>
    </div>`;
}
```
此为产品可用性的底线检查，不做此检查可能导致用户在某些浏览器上白屏。

#### 1.2 数据库与 Service 层（2.5 小时）

- 创建 `src/db/index.ts`：Dexie 数据库定义，包含三个表和搜索索引
- 创建 `src/services/` 实现三个核心 Service：
  - `sceneService.ts`：场景 CRUD，支持 sortOrder 排序
  - `promptService.ts`：提示词 CRUD，支持按场景/标签/收藏筛选，保存时自动生成版本
  - `versionService.ts`：版本查询、回滚、差异获取
- 实现 `savePrompt` 原子事务（保存内容同时生成新版本）
- **版本回滚设计决策**：回滚 = 更新 Prompt.currentVersionId，**不生成新版本**。
  - 原因：频繁回滚测试不同版本时，生成新版本会污染版本历史
  - 如需基于旧版本创建新分支，使用"基于此版本编辑"功能（阶段三）

#### 1.3 全局状态管理（1 小时）

创建 `src/store/useAppStore.ts`，**单 Store + slice 模式**：

```typescript
interface AppStore {
  // Scene 域
  scenes: Scene[];
  activeSceneId: string | null;
  // Prompt 域
  prompts: Prompt[];
  activePromptId: string | null;
  // 版本域
  versions: Version[];
  // UI 状态
  searchQuery: string;
  isStarredFilter: boolean;
  isLoading: boolean;
  storageInfo: { used: number; quota: number | null }; // 存储用量信息
  // 统一加载
  loadAll: () => Promise<void>;
  setActiveScene: (id: string | null) => void;
  setActivePrompt: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleStarredFilter: () => void;
  refreshStorageInfo: () => Promise<void>;
}
```

**核心约束**：Store 是 Service 层的"消费者"，不包含业务逻辑，只做状态同步。

#### 1.4 基础布局与路由（1 小时）

```
路由结构：
/              → HomePage（三栏布局）
/prompts/:id   → PromptDetailPage（提示词详情 + 版本管理）
```

- 顶部导航栏：搜索框（基础按名称搜索）、导出/导入按钮
- 左侧边栏：场景列表 + "已收藏"入口 + 新建场景按钮
- 主内容区：响应式三栏布局骨架
- 场景切换逻辑（切换场景 → 更新 URL 参数 → 加载对应提示词）

#### 1.5 场景管理（1 小时）

- 场景列表渲染（图标 + 颜色 + 名称）
- 新建场景弹窗（名称、描述、颜色选择）
- 编辑/删除场景（删除场景时确认是否同时删除其下提示词）
- 空状态设计（无场景时展示引导提示）
- **首次用户引导**：无场景时推荐用户创建首个场景，提供快捷入口

#### 1.6 提示词管理（1.5 小时）

- 提示词卡片网格布局
- 新建提示词（自动关联当前场景）
- 点击卡片跳转到 `/prompts/:id` 详情页
- 提示词 CRUD 操作
- **基础搜索**：按名称/内容关键词实时过滤（`Dexie.filter()` 或 Store 层过滤）
- **搜索架构预留**：搜索功能在数据结构层面已支持（Dexie 索引），阶段三增加高级搜索时只需扩展 UI 层，不必改动数据层

#### 1.7 版本管理与导入导出（3 小时）

**版本管理（1.5 小时）：**
- 版本自动生成逻辑（`v1.0.0 → v1.0.1 → v1.0.2`，patch 级别递增）
- 版本历史列表展示（按时间倒序）
- **版本回滚**：更新 Prompt.currentVersionId + Prompt.content，不生成新版本
- 版本保护/删除（isProtected=受保护版本不可删，isInitial=初始版本不可删）

**全量导出（0.5 小时）：**
- JSON 文件下载（包含 version 标记 + 导出时间元数据）

**全量导入（1 小时）：**
- JSON 文件解析 + **数据完整性校验**（必做！）：
  - 校验数据结构完整性（字段类型、必填项）
  - 校验 ID 唯一性和外键一致性（场景 ID 必须存在、版本的外键必须指向存在的 Prompt）
  - 校验失败时给出详细错误提示，提示用户选择文件
- ⚠️ **导入 ID 冲突处理（MVP 版本也必须做！）**：
  - **覆盖**：以导入数据为准，覆盖本地已有记录
  - **跳过**：保留本地数据，跳过冲突记录
  - 阶段一再添加"重命名"选项，但覆盖和跳过必须在 MVP 支持
  - 冲突检测逻辑：导入前检查 scenes/prompts 的 ID 是否与本地数据库已存在的记录冲突

#### ✅ 阶段一验收测试清单（手动执行）

验收项应通过后再进入阶段二：

1. □ 新建→编辑→删除场景全流程
2. □ 新建提示词，验证自动生成 v1.0.0 版本
3. □ 修改提示词内容并保存，验证自动生成 v1.0.1 版本
4. □ 内容未变时保存，验证不生成新版本
5. □ 版本回滚后 Prompt.content 是否更新为回滚版本内容
6. □ 回滚后验证未生成新版本
7. □ 导出空数据库（仅默认场景）→ 清除 IndexedDB → 重新导入 → 验证数据恢复
8. □ 导出含 3 个版本的数据 → 重新导入 → 验证版本历史完整
9. □ 导入格式错误的 JSON 文件 → 验证是否给出友好错误提示
10. □ 导入与自己 ID 冲突的数据 → 验证覆盖/跳过策略是否生效
11. □ IndexedDB 不可用时（可用 DevTools 模拟）→ 验证检测提示
12. □ 浏览器前进/后退按钮是否正常工作
13. □ 搜索框输入关键词 → 验证实时过滤

---

### 阶段二：核心体验打磨 + PWA 基础（6-7 小时，第 3-4 个半天）

**目标**：提升产品可用性，强化核心差异化体验

#### 2.1 版本对比功能（1.5 小时）

- 集成 `diff-match-patch` 库
- 实现两个版本内容的差异对比
- 高亮显示新增（绿色）、删除（红色）、修改（橙色）内容
- 支持并排对比和 inline 对比两种模式

#### 2.2 收藏与快速访问（0.5 小时）

- 提示词卡片添加收藏按钮（星标切换）
- 左侧边栏添加"收藏夹"快速入口
- 收藏状态同步到数据库（`isStarred` 字段已有索引）

#### 2.3 基础用户体验优化（1.5 小时）

- 复制提示词功能（一键复制当前版本内容到剪贴板）
- Toast 操作提示（保存成功/失败/复制成功/导入结果）
- 删除操作二次确认（AlertDialog）
- 自动保存草稿（每 30 秒保存一次）
- 加载状态骨架屏

#### 2.4 快捷键基础支持（0.5 小时）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 保存当前提示词 |
| `Ctrl+F` | 聚焦搜索框 |
| `Ctrl+E` | 导出当前数据 |
| `Escape` | 关闭弹窗/返回列表 |

#### 2.5 空状态与错误边界（0.5 小时）

- 无场景时的引导页（"创建第一个场景"）
- 无提示词时的引导提示（"在当前场景下创建第一个提示词"）
- React Error Boundary 包裹，防止白屏

#### 2.6 PWA 基础配置（1 小时）

- 添加 manifest.json（应用名称、图标、主题色）
- 配置 Service Worker 缓存策略（至少缓存应用 Shell）
- 验证：可在 Chrome DevTools → Application → Manifest 中看到安装提示
- 定位：此阶段完成基础 PWA 配置，确保"离线可用"这一核心卖点可被用户感知

---

### 阶段三：功能完善（6-7 小时，第 5 个半天）

**目标**：补齐常用功能，满足大多数用户日常使用需求

#### 3.1 标签管理（1 小时）

- 提示词添加标签功能（TagInput 组件）
- 标签筛选（侧边栏或过滤栏）
- 标签自动补全（从已有标签中建议）

#### 3.2 备注说明（0.5 小时）

- 提示词详情页添加备注输入框（Markdown 渲染可选）

#### 3.3 增强导入导出（1.5 小时）

- 支持导出单个场景（含其下所有 Prompt 和版本）
- 支持导出单个提示词（含其版本历史）
- 导出时选项：是否包含版本历史
- 导入时新增"重命名"冲突处理策略（为导入数据重新生成 ID）

#### 3.4 高级搜索（1 小时）

- 按标签筛选（已有标签索引支持）
- 按创建时间/更新时间范围筛选（日期选择器）
- 搜索结果高亮关键词
- 搜索历史（可选，localStorage 存储最近 10 条）

#### 3.5 编辑器升级（1.5 小时）

- 集成 CodeMirror 6（`@uiw/react-codemirror`）
- 配置 Markdown/JSON 语法高亮
- 行号、自动换行、自适应高度
- 编辑器内快捷键支持（Tab 缩进、Ctrl+Z 撤销）

#### 3.6 快捷键完善（0.5 小时）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+S` | 另存为新版本并填写 changelog |
| `Ctrl+Shift+F` | 高级搜索面板 |
| `Ctrl+D` | 删除当前提示词 |

---

### 阶段四：优化与部署（4-5 小时，第 6 个半天）

**目标**：完成产品上线前的所有准备工作

#### 4.1 UI 细节打磨（1 小时）

- 统一组件间距、圆角、阴影（遵循 shadcn/ui 主题变量）
- hover 和点击反馈效果（transform scale / 颜色过渡）
- 错误状态和重试机制

#### 4.2 暗色模式（0.5 小时）

- 基于 Tailwind `dark:` 和 shadcn/ui 主题变量
- 系统主题自动检测 + 手动切换
- 持久化用户偏好到 localStorage

#### 4.3 数据安全增强（1 小时）

⚠️ **核心设计原则**：localStorage 和 IndexedDB 都属于浏览器存储，清除浏览数据时会被一同清除。因此真正的长期存档必须依赖导出到本地文件。

- **状态栏导出提醒**：首页状态栏显示"上次导出：X 天前"。超过 7 天未导出时提示"建议导出备份"，点击即触发全量 JSON 下载到系统 Downloads 文件夹
- **localStorage 快照**（辅助）：每天首次打开时备份到 localStorage（保留最近 3 份），用于防误操作回退。需说明此备份不清除浏览器数据时有效，但不可替代导出到文件
- 数据恢复功能：支持从 localStorage 快照和本地 JSON 文件两种方式恢复
- 备份提醒：每周一次提示
- **存储空间用量提示**：在状态栏中显示 IndexedDB 用量
- **存储上限超限处理**：检测 `navigator.storage.estimate()`，当使用量超过配额 80% 时提示用户导出并清理

#### 4.4 响应式设计（0.5 小时）

- 适配平板和手机屏幕
- 移动端：三栏 → 单栏递进式布局
- 触控优化：增大点击区域（最小 touch target 44px）

#### 4.5 部署与上线（1.5 小时）

- 构建静态文件：`npm run build`
- 部署到 Cloudflare Pages / Vercel / GitHub Pages
- 编写 README：功能介绍、使用说明、开发指南
- PWA 上线验证：检查 Lighthouse PWA 评分

---

## 五、核心 Service 架构

### Service 层职责划分

```
src/services/
├── sceneService.ts    # 场景 CRUD + 排序
├── promptService.ts   # 提示词 CRUD + 搜索 + 收藏
└── versionService.ts  # 版本管理 + 回滚 + diff
```

### Service 层设计原则

- **纯数据操作**：Service 层只操作 Dexie，不关心 UI 状态
- **返回原始数据**：不封装成 Store action，供 Store 和组件共同调用
- **事务保障**：所有写操作都在 Dexie 事务中执行

### 关键代码示例

#### 版本号生成

```typescript
// src/utils/version.ts
export type VersionBump = 'major' | 'minor' | 'patch';

export function generateNextVersion(
  lastVersion: string = 'v1.0.0',
  bump: VersionBump = 'patch'
): string {
  const [major, minor, patch] = lastVersion
    .replace('v', '')
    .split('.')
    .map(Number);

  switch (bump) {
    case 'major': return `v${major + 1}.0.0`;
    case 'minor': return `v${major}.${minor + 1}.0`;
    case 'patch': return `v${major}.${minor}.${patch + 1}`;
  }
}

// 版本号排序比较
export function compareVersions(a: string, b: string): number {
  const [aMaj, aMin, aPatch] = a.replace('v', '').split('.').map(Number);
  const [bMaj, bMin, bPatch] = b.replace('v', '').split('.').map(Number);
  return aMaj - bMaj || aMin - bMin || aPatch - bPatch;
}
```

#### 保存提示词并自动生成版本（原子事务）

```typescript
// src/services/promptService.ts
import { db } from '../db';
import { generateNextVersion } from '../utils/version';

export async function savePrompt(
  prompt: Partial<Prompt>,
  changeLog: string = '更新内容'
) {
  return db.transaction('rw', db.prompts, db.versions, async () => {
    const now = Date.now();

    if (prompt.id) {
      const existingPrompt = await db.prompts.get(prompt.id);
      if (!existingPrompt) throw new Error('提示词不存在');

      const updatedContent = prompt.content ?? existingPrompt.content;
      const updatedPrompt = {
        ...existingPrompt,
        ...prompt,
        content: updatedContent,
        updatedAt: now,
      };

      await db.prompts.put(updatedPrompt);

      // 如果内容没有变化则不生成新版本
      if (updatedContent === existingPrompt.content) {
        return updatedPrompt;
      }

      // 获取最新版本号
      const lastVersion = await db.versions
        .where('promptId')
        .equals(prompt.id)
        .reverse()
        .sortBy('createdAt');

      const nextVersion = generateNextVersion(lastVersion[0]?.version);

      const newVersionId = await db.versions.add({
        id: crypto.randomUUID(),
        promptId: prompt.id,
        version: nextVersion,
        content: updatedContent,
        changeLog,
        isProtected: false,
        isInitial: false,
        createdAt: now,
      });

      await db.prompts.update(prompt.id, { currentVersionId: newVersionId });

      return { ...updatedPrompt, currentVersionId: newVersionId };
    } else {
      const id = crypto.randomUUID();
      await db.prompts.add({
        id,
        sceneId: prompt.sceneId!,
        name: prompt.name || '未命名提示词',
        content: prompt.content || '',
        isStarred: false,
        currentVersionId: '',
        tags: [],
        notes: '',
        createdAt: now,
        updatedAt: now,
      });

      const versionId = await db.versions.add({
        id: crypto.randomUUID(),
        promptId: id,
        version: 'v1.0.0',
        content: prompt.content || '',
        changeLog: '初始版本',
        isProtected: true,
        isInitial: true,
        createdAt: now,
      });

      await db.prompts.update(id, { currentVersionId: versionId });
      return db.prompts.get(id);
    }
  });
}
```

#### 版本回滚（不生成新版本）

```typescript
// src/services/versionService.ts
export async function rollbackToVersion(promptId: string, versionId: string) {
  return db.transaction('rw', db.prompts, db.versions, async () => {
    const version = await db.versions.get(versionId);
    if (!version) throw new Error('版本不存在');
    if (version.promptId !== promptId) throw new Error('版本与提示词不匹配');

    const prompt = await db.prompts.get(promptId);
    if (!prompt) throw new Error('提示词不存在');

    // 更新 prompt 的内容和当前版本 ID，不生成新版本
    await db.prompts.update(promptId, {
      content: version.content,
      currentVersionId: versionId,
      updatedAt: Date.now(),
    });

    return db.prompts.get(promptId);
  });
}
```

#### 全量导出

```typescript
// src/utils/export-import.ts
import { db } from '../db';
import type { ExportData } from '../types';

export async function exportAllData(): Promise<void> {
  const [scenes, prompts, versions] = await Promise.all([
    db.scenes.toArray(),
    db.prompts.toArray(),
    db.versions.toArray(),
  ]);

  const data: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    scenes,
    prompts,
    versions,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-prompt-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### 导入数据校验（包含 ID 冲突处理）

```typescript
// src/utils/export-import.ts
type ConflictStrategy = 'overwrite' | 'skip';

interface ImportResult {
  success: boolean;
  message: string;
  stats: { scenes: number; prompts: number; versions: number };
  conflicts: { type: 'scene' | 'prompt'; id: string; name: string }[];
}

export function validateImportData(jsonStr: string): { data?: ExportData; error?: string } {
  let data: ExportData;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return { error: 'JSON 解析失败，请检查文件格式' };
  }

  if (!data.version || !Array.isArray(data.scenes) || !Array.isArray(data.prompts) || !Array.isArray(data.versions)) {
    return { error: '数据格式不完整，缺少 scenes/prompts/versions 字段' };
  }

  // 校验外键一致性
  const sceneIds = new Set(data.scenes.map((s) => s.id));
  const promptIds = new Set(data.prompts.map((p) => p.id));

  for (const prompt of data.prompts) {
    if (!sceneIds.has(prompt.sceneId)) {
      return { error: `提示词 "${prompt.name}" 关联的场景 ID "${prompt.sceneId}" 不存在` };
    }
  }

  for (const version of data.versions) {
    if (!promptIds.has(version.promptId)) {
      return { error: `版本 "${version.version}" 关联的提示词 ID "${version.promptId}" 不存在` };
    }
  }

  return { data };
}

export async function detectConflicts(data: ExportData): Promise<ImportResult['conflicts']> {
  const conflicts: ImportResult['conflicts'] = [];

  for (const scene of data.scenes) {
    const existing = await db.scenes.get(scene.id);
    if (existing) conflicts.push({ type: 'scene', id: scene.id, name: scene.name });
  }
  for (const prompt of data.prompts) {
    const existing = await db.prompts.get(prompt.id);
    if (existing) conflicts.push({ type: 'prompt', id: prompt.id, name: prompt.name });
  }

  return conflicts;
}

export async function importData(
  jsonStr: string,
  strategy: ConflictStrategy = 'skip'
): Promise<ImportResult> {
  const validation = validateImportData(jsonStr);
  if (validation.error) {
    return { success: false, message: validation.error, stats: { scenes: 0, prompts: 0, versions: 0 }, conflicts: [] };
  }

  const data = validation.data!;
  const conflicts = await detectConflicts(data);
  const conflictIds = new Set(conflicts.map((c) => c.id));

  return db.transaction('rw', db.scenes, db.prompts, db.versions, async () => {
    const filterConflicts = <T extends { id: string }>(items: T[]) =>
      strategy === 'skip'
        ? items.filter((item) => !conflictIds.has(item.id))
        : items; // 'overwrite': put will replace

    const writeScenes = filterConflicts(data.scenes);
    const writePrompts = filterConflicts(data.prompts);

    if (strategy === 'overwrite') {
      for (const item of writeScenes) await db.scenes.put(item);
      for (const item of writePrompts) await db.prompts.put(item);
      // 只导入关联 prompt 已成功导入的版本
      const importedPromptIds = new Set(writePrompts.map((p) => p.id));
      const writeVersions = data.versions.filter((v) => importedPromptIds.has(v.promptId));
      for (const item of writeVersions) await db.versions.put(item);
    } else {
      if (writeScenes.length > 0) await db.scenes.bulkAdd(writeScenes, { allKeys: true });
      if (writePrompts.length > 0) await db.prompts.bulkAdd(writePrompts, { allKeys: true });
      // 只添加关联的 prompt 已成功导入的版本
      const importedPromptIds = new Set(writePrompts.map((p) => p.id));
      const writeVersions = data.versions.filter((v) => importedPromptIds.has(v.promptId));
      if (writeVersions.length > 0) await db.versions.bulkAdd(writeVersions, { allKeys: true });
    }

    return {
      success: true,
      message: `导入成功：${writeScenes.length} 个场景，${writePrompts.length} 个提示词${conflicts.length > 0 ? `（${conflicts.length} 个冲突已${strategy === 'skip' ? '跳过' : '覆盖'}）` : ''}`,
      stats: { scenes: writeScenes.length, prompts: writePrompts.length, versions: data.versions.length },
      conflicts,
    };
  });
}
```

---

## 六、项目最终目录结构

```
ai-prompt-manager/
├── src/
│   ├── components/          # UI 组件
│   │   ├── layout/          # 全局布局
│   │   │   ├── Header.tsx       # 顶部导航栏（搜索+导入导出）
│   │   │   ├── Sidebar.tsx      # 左侧边栏（场景列表+收藏）
│   │   │   └── MainContent.tsx  # 主内容区容器
│   │   ├── scene/           # 场景组件
│   │   │   ├── SceneList.tsx
│   │   │   └── SceneForm.tsx
│   │   ├── prompt/          # 提示词组件
│   │   │   ├── PromptCard.tsx
│   │   │   ├── PromptList.tsx
│   │   │   └── PromptEditor.tsx
│   │   ├── version/         # 版本组件
│   │   │   ├── VersionList.tsx
│   │   │   └── VersionDiff.tsx
│   │   └── ui/              # shadcn/ui 组件（自动生成）
│   ├── services/            # 业务逻辑层
│   │   ├── sceneService.ts
│   │   ├── promptService.ts
│   │   └── versionService.ts
│   ├── store/               # Zustand 状态管理
│   │   └── useAppStore.ts   # 单 Store + slice 模式
│   ├── db/                  # 数据层
│   │   └── index.ts         # Dexie 数据库定义
│   ├── types/               # 类型定义
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   ├── version.ts
│   │   ├── export-import.ts
│   │   └── helpers.ts
│   ├── pages/               # 路由页面
│   │   ├── HomePage.tsx
│   │   └── PromptDetailPage.tsx
│   ├── App.tsx              # 路由配置
│   ├── main.tsx             # 入口（含 IndexedDB 检测）
│   └── index.css            # Tailwind 入口
├── public/
│   ├── manifest.json        # PWA 配置文件
│   └── icons/               # PWA 应用图标
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 七、风险提示与应对措施

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| IndexedDB 浏览器兼容性 | 低 | 高 | 入口处检测 `window.indexedDB`，不支持时展示友好提示页而非白屏（阶段一） |
| IndexedDB 存储上限超限 | 中 | 中 | 各浏览器约 50MB~无上限；阶段一在 Store 中记录 `storageInfo`；阶段四检测 `navigator.storage.estimate()` 并在超过 80% 时预警 |
| 导入数据 ID 冲突 | 高 | 中 | **阶段一必须支持"覆盖"和"跳过"两种策略**，阶段三增加"重命名"。导入前预检冲突并展示给用户选择 |
| 并发写入版本号碰撞 | 中 | 低 | 单用户操作几乎无并发写；Dexie 事务保证原子性 |
| 大数据量性能（万级 Prompt） | 中 | 中 | 阶段一即建立合理索引；列表超 500 条时引入 react-window（阶段四）；搜索加防抖 |
| 浏览器存储数据丢失 | 低 | 高 | localStorage 快照保留 3 份（防误操作回退）；首页状态栏提示定期导出到本地文件（防清除浏览器数据）——两者配合，前者管误删、后者管存档 |
| 用户误操作删除 | 中 | 中 | 删除二次确认（阶段二）；初始版本（isInitial）不可删除；可考虑软删除方案 |
| 工时超预期 | 高 | 中 | 阶段一实际可能超时 50%，建议完成后重新校准后续阶段工时；每个阶段独立可交付，超时可暂缓非关键功能 |

---

## 八、测试策略

### 设计理念

数据管理类应用的导入导出正确性是用户信任的基础。一个 bug 导致用户数据损坏或丢失，用户会立即弃用。

### 验收测试清单（手动执行，每个阶段完成后执行）

**阶段一核心冒烟测试（每次提交前执行）：**
- [ ] 导出空数据库 → 清除 IndexedDB → 重新导入 → 验证数据完整恢复
- [ ] 导出含多版本（≥3个）的数据 → 清除 IndexedDB → 重新导入 → 验证版本历史完整
- [ ] 导入格式错误的 JSON 文件 → 验证错误提示是否友好
- [ ] 导入与自己 ID 冲突的数据 → 验证覆盖/跳过策略生效
- [ ] 新建→编辑→删除场景全流程
- [ ] 新建提示词 → 编辑保存 → 验证自动生成新版本
- [ ] 内容未变时保存 → 验证不生成新版本
- [ ] 版本回滚 → 验证内容更新且不生成新版本
- [ ] 浏览器前进/后退按钮正常工作

**阶段二补充：**
- [ ] 版本对比高亮显示是否正确
- [ ] 收藏/取消收藏 → 刷新页面后状态保持
- [ ] 快捷键是否正常工作

**阶段三补充：**
- [ ] 标签添加/删除/筛选
- [ ] 导出单个场景 → 导入 → 验证数据完整性
- [ ] 导出单个提示词 → 导入 → 验证版本历史完整

**阶段四补充：**
- [ ] 暗色模式切换 → 刷新后偏好保持
- [ ] 响应式布局在手机/平板视图下可用
- [ ] PWA 安装提示正常显示
- [ ] Lighthouse PWA 评分 ≥ 80

---

## 九、下一步行动建议

1. **阶段一拆分执行**：12-14 小时建议拆为 2 个半天，中间休息一次。第 1 天做完 1.1-1.4（项目初始化→布局），第 2 天做完 1.5-1.7（场景→提示词→版本+导入导出）

2. **从前到后，逐层推进**：DB → Service → Store → UI，避免跳过数据层直接写组件

3. **每个子任务完成后手动测试**：不要等阶段结束后再统一测试。一次"全量导入导出"冒烟测试只要 3 分钟，但能避免半天的工作白费

4. **阶段一验收清单打勾后再进入阶段二**：见第八章测试策略

5. **MVP 完成后自用一周**：收集真实使用反馈再进入阶段三。重点验证：版本管理的使用频率、搜索的流畅度、导入导出是否覆盖真实使用场景

6. **保持产品简洁**：先不做用户系统、不做云同步、不做协作编辑，聚焦本地单用户体验
