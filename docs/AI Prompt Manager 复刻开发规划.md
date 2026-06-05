# AI Prompt Manager 复刻开发规划

**文档版本**：v1\.0

**更新日期**：2026\-06\-04

**开发模式**：Vibe Coding 纯前端本地优先

**预计总工时**：15\-20 小时（分 4 个半天完成）

---

## 一、产品核心定位与价值

### 产品定位

**纯浏览器本地 Prompt 全生命周期管理工具**，依托前端 IndexedDB 实现全数据本地落盘，从分类归档→版本迭代→备份流转一站式管理企业 / 个人提示词资产，私有数据不上云，兼顾安全与协作。

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

表格

---

## 三、数据结构最终设计（核心基石）

typescript运行

```Plain Text
// 场景表（一级分类）
interface Scene {
  id: string; // 唯一ID，crypto.randomUUID()生成
  name: string; // 场景名称，如"产品需求分析"
  description: string; // 场景描述
  color: string; // 左侧边栏图标颜色，如"#3b82f6"
  icon: string; // Lucide图标名称，如"FileText"
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
}

// 提示词表（二级条目）
interface Prompt {
  id: string;
  sceneId: string; // 所属场景ID（外键）
  name: string; // 提示词名称，如"AI_select_word"
  content: string; // 当前版本的提示词内容
  isStarred: boolean; // 收藏标记，快速定位常用提示词
  currentVersionId: string; // 当前使用的版本ID（关键优化）
  createdAt: number;
  updatedAt: number;
}

// 版本历史表（三级迭代）
interface Version {
  id: string;
  promptId: string; // 所属提示词ID（外键）
  version: string; // 语义化版本号，如"v1.0.6"
  content: string; // 该版本的完整提示词内容
  changeLog: string; // 更新说明
  isProtected: boolean; // 保护版本，防止被误删除
  createdAt: number; // 创建时间戳
}
```

---

## 四、分阶段开发路线图（可直接执行）

### 阶段一：MVP 核心功能（6\-8 小时，第 1 个半天）

**目标**：跑通核心流程，实现产品最小可用版本，不做任何非必要功能

1. **项目初始化与环境配置（1 小时）**bash运行

```Plain Text
# 推荐：pnpm（速度最快、磁盘占用最低）
pnpm create vite@latest ai-prompt-manager -- --template react-ts

cd ai-prompt-manager
pnpm install dexie zustand lucide-react uuid diff-match-patch
pnpm install -D tailwindcss postcss autoprefixer @types/uuid
npx tailwindcss init -p
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input textarea card scroll-area dialog toast
```

- 配置 Tailwind CSS（复制 shadcn/ui 官方配置）

- 配置 TypeScript 严格模式

- 配置全局样式重置

    2. **数据库与 Service 层实现（1\.5 小时）**创建`src/db/index.ts`，使用 Dexie 定义三个表创建`src/services/`目录，实现三个核心 Service： `sceneService.ts`：场景的增删改查`promptService.ts`：提示词的增删改查`versionService.ts`：版本的生成、查询、回滚实现原子事务操作（保存提示词时自动生成新版本）

    3. **全局状态管理实现（1 小时）**创建`src/store/`目录，实现两个 Zustand Store： `sceneStore.ts`：管理场景列表和当前选中场景`promptStore.ts`：管理提示词列表和当前选中提示词实现数据加载、更新、删除的状态同步

    4. **基础布局实现（1 小时）**顶部导航栏（搜索框、导出 / 导入按钮）左侧边栏（场景列表、新建场景按钮）主内容区（响应式三栏布局骨架）实现场景切换逻辑

    5. **场景管理功能（1 小时）**场景列表渲染（带图标和颜色）新建场景弹窗（名称、描述、颜色选择）编辑 / 删除场景功能空状态设计

    6. **提示词管理功能（1 小时）**提示词卡片网格布局新建提示词（自动关联当前场景）点击卡片进入详情页基本的增删改查

    7. **核心版本管理与导入导出（1\.5 小时）**自动版本生成逻辑（语义化版本号）版本历史列表展示版本回滚功能全量导出为 JSON 文件全量导入 JSON 文件（基础数据校验）

### 阶段二：核心体验打磨（3\-4 小时，第 2 个半天）

- **目标**：提升产品可用性，强化核心差异化体验

    1. **版本对比功能（1\.5 小时）**集成`diff-match-patch`库实现两个版本内容的差异对比高亮显示新增、删除、修改的内容支持并排对比和 inline 对比两种模式

    2. **收藏与快速访问（0\.5 小时）**提示词卡片添加收藏按钮左侧边栏添加 "已收藏" 快速入口收藏状态同步到数据库

    3. **编辑器体验优化（1 小时）**集成 CodeMirror 6 替代普通 textarea配置 JSON 语法高亮、行号、自动换行实现编辑器自适应高度

    4. **基础用户体验优化（1 小时）**复制提示词功能（一键复制当前版本）Toast 操作提示（成功 / 失败 / 复制成功）删除操作二次确认自动保存草稿（每 30 秒保存一次）

### 阶段三：功能完善（4\-5 小时，第 3 个半天）

- **目标**：补齐常用功能，满足大多数用户日常使用需求

    1. **标签管理（1 小时）**提示词添加标签功能标签筛选功能标签自动补全

    2. **备注说明（0\.5 小时）**提示词详情页添加备注输入框备注内容保存到数据库

    3. **高级导入导出（1\.5 小时）**支持导出单个场景支持导出单个提示词导出时可选择 "是否包含版本历史"导入时 ID 冲突处理（覆盖 / 跳过 / 重命名）

    4. **高级搜索（1 小时）**全局搜索支持按标签搜索支持按创建 / 更新时间筛选搜索结果高亮显示关键词

    5. **快捷键支持（0\.5 小时）**`Ctrl+S`：保存当前提示词`Ctrl+F`：聚焦搜索框`Ctrl+C`：复制当前提示词`Esc`：关闭弹窗 / 返回上一级

### 阶段四：优化与部署（2\-3 小时，第 4 个半天）

- **目标**：完成产品上线前的所有准备工作

    1. **UI 细节优化（1 小时）**统一所有组件的间距、圆角、阴影优化加载状态和空状态添加 hover 和点击反馈效果

    2. **数据安全优化（0\.5 小时）**实现自动备份功能（每天备份一次到 localStorage）实现数据恢复功能添加备份提醒（每周一次）

    3. **响应式设计（0\.5 小时）**适配平板和手机屏幕移动端优化布局和交互

    4. **部署与文档（1 小时）**构建静态文件：`npm run build`部署到 Vercel/GitHub Pages编写 README 文档（功能介绍、使用说明、开发指南）

---

## 五、核心功能实现代码示例

### 版本号自动生成

- typescript运行

```Plain Text
// src/utils/version.ts
export function generateNextVersion(lastVersion: string = 'v1.0.0'): string {
  const [major, minor, patch] = lastVersion
    .replace('v', '')
    .split('.')
    .map(Number);
  
  return `v${major}.${minor}.${patch + 1}`;
}
```

### 保存提示词并自动生成新版本（原子事务）

- typescript运行

```Plain Text
// src/services/promptService.ts
import { db } from '../db';
import { generateNextVersion } from '../utils/version';

export async function savePrompt(prompt: Partial<Prompt>, changeLog: string = '更新内容') {
  return db.transaction('rw', db.prompts, db.versions, async () => {
    const now = Date.now();
    
    if (prompt.id) {
      // 更新现有提示词
      const existingPrompt = await db.prompts.get(prompt.id);
      if (!existingPrompt) throw new Error('提示词不存在');
      
      const updatedPrompt = {
        ...existingPrompt,
        ...prompt,
        updatedAt: now
      };
      
      await db.prompts.put(updatedPrompt);
      
      // 生成新版本
      const lastVersion = await db.versions
        .where('promptId')
        .equals(prompt.id)
        .orderBy('createdAt')
        .last();
      
      const nextVersion = generateNextVersion(lastVersion?.version);
      
      const newVersion = {
        id: crypto.randomUUID(),
        promptId: prompt.id,
        version: nextVersion,
        content: updatedPrompt.content,
        changeLog,
        isProtected: false,
        createdAt: now
      };
      
      const versionId = await db.versions.add(newVersion);
      
      // 更新当前版本ID
      await db.prompts.update(prompt.id, { currentVersionId: versionId });
      
      return { ...updatedPrompt, currentVersionId: versionId };
    } else {
      // 创建新提示词
      const newPrompt: Prompt = {
        id: crypto.randomUUID(),
        sceneId: prompt.sceneId!,
        name: prompt.name!,
        content: prompt.content || '',
        isStarred: false,
        currentVersionId: '',
        createdAt: now,
        updatedAt: now
      };
      
      const promptId = await db.prompts.add(newPrompt);
      
      // 创建初始版本
      const initialVersion: Version = {
        id: crypto.randomUUID(),
        promptId,
        version: 'v1.0.0',
        content: newPrompt.content,
        changeLog: '初始版本',
        isProtected: true,
        createdAt: now
      };
      
      const versionId = await db.versions.add(initialVersion);
      
      // 更新当前版本ID
      await db.prompts.update(promptId, { currentVersionId: versionId });
      
      return { ...newPrompt, id: promptId, currentVersionId: versionId };
    }
  });
}
```

### 全量导出

- typescript运行

```Plain Text
// src/utils/export-import.ts
import { db } from '../db';

export async function exportAllData() {
  const scenes = await db.scenes.toArray();
  const prompts = await db.prompts.toArray();
  const versions = await db.versions.toArray();
  
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    scenes,
    prompts,
    versions
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-prompt-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 六、项目最终目录结构

- plaintext

```Plain Text
ai-prompt-manager/
├── src/
│   ├── components/          # 可复用UI组件
│   │   ├── layout/          # 全局布局组件
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainContent.tsx
│   │   ├── scene/           # 场景相关组件
│   │   │   ├── SceneList.tsx
│   │   │   └── SceneForm.tsx
│   │   ├── prompt/          # 提示词相关组件
│   │   │   ├── PromptCard.tsx
│   │   │   ├── PromptList.tsx
│   │   │   └── PromptEditor.tsx
│   │   └── version/         # 版本相关组件
│   │       ├── VersionList.tsx
│   │       └── VersionDiff.tsx
│   ├── services/            # 业务逻辑层（核心）
│   │   ├── sceneService.ts
│   │   ├── promptService.ts
│   │   └── versionService.ts
│   ├── store/               # Zustand状态管理
│   │   ├── sceneStore.ts
│   │   └── promptStore.ts
│   ├── db/                  # 数据库定义
│   │   └── index.ts
│   ├── types/               # TypeScript类型定义
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   ├── version.ts
│   │   ├── export-import.ts
│   │   └── helpers.ts
│   ├── pages/               # 页面组件
│   │   ├── HomePage.tsx
│   │   └── PromptDetailPage.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 七、风险提示与应对措施

- 表格

---

## 八、下一步行动建议

1. **立即开始阶段一**：先把项目骨架搭起来，跑通数据库和基础布局

2. **优先实现核心功能**：先做版本管理和导入导出，这是产品的灵魂

3. **小步快跑，快速迭代**：每个阶段完成后都测试一下，及时发现问题

4. **MVP 完成后先自用**：自己用一周，收集真实使用反馈再优化

5. **保持产品简洁**：不要急于添加太多功能，专注于把核心体验做到极致

