import Dexie, { type EntityTable } from 'dexie';
import type { Scene, Prompt, Version, ExportData, User } from '@/types';
import { PUBLIC_USER_ID } from '@/constants';
import { generateId } from '@/utils/helpers';

export interface SnapshotEntry {
  id: string;
  timestamp: number;
  date: string;
  data: ExportData;
}

const db = new Dexie('AIPromptManager') as Dexie & {
  scenes: EntityTable<Scene, 'id'>;
  prompts: EntityTable<Prompt, 'id'>;
  versions: EntityTable<Version, 'id'>;
  snapshots: EntityTable<SnapshotEntry, 'id'>;
  users: EntityTable<User, 'id'>;
};

db.version(1).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, createdAt',
});

db.version(2).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, score, createdAt',
});

db.version(3).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, score, createdAt',
  snapshots: 'id, date, timestamp',
});

db.version(4).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, score, createdAt',
  snapshots: 'id, date, timestamp',
  users: 'id, username, createdAt',
});

db.version(5).stores({
  scenes: 'id, name, sortOrder, createdAt, userId',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt, userId',
  versions: 'id, promptId, version, score, createdAt',
  snapshots: 'id, date, timestamp',
  users: 'id, username, createdAt',
});

db.version(6).stores({
  scenes: 'id, name, sortOrder, createdAt, userId',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt, userId',
  versions: 'id, promptId, version, score, createdAt',
  snapshots: 'id, date, timestamp',
  users: 'id, username, createdAt',
});

db.version(7).stores({
  scenes: 'id, name, sortOrder, createdAt, userId',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt, userId',
  versions: 'id, promptId, version, score, createdAt',
  snapshots: 'id, date, timestamp',
  users: 'id, username, createdAt',
}).upgrade(async () => {
  const existingScenes = await db.scenes
    .where('userId').equals(PUBLIC_USER_ID)
    .toArray();
  const existingSceneIds = existingScenes.map((s) => s.id);

  if (existingSceneIds.length > 0) {
    await db.prompts.where('sceneId').anyOf(existingSceneIds).delete();
    await db.scenes.where('id').anyOf(existingSceneIds).delete();
  }

  const now = Date.now();
  const sceneId = generateId();

  await db.scenes.add({
    id: sceneId,
    userId: PUBLIC_USER_ID,
    name: '入门指南',
    description: '了解产品的基本功能和使用方法',
    color: '#3b82f6',
    icon: 'book-open',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.prompts.add({
    id: generateId(),
    userId: PUBLIC_USER_ID,
    sceneId,
    name: '用户使用手册',
    content: `# AI Prompt Manager 使用手册

## 系统架构

<div align="center">
<svg viewBox="0 0 800 260" width="100%" max-width="700" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc;border-radius:12px;padding:16px;font-family:system-ui,sans-serif">
  <defs>
    <linearGradient id="fe" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient>
    <linearGradient id="be" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>
    <linearGradient id="db" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#34d399"/></linearGradient>
    <linearGradient id="ai" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#ef4444"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/></filter>
  </defs>

  <rect x="20" y="50" width="760" height="40" rx="8" fill="url(#fe)" filter="url(#shadow)"/>
  <text x="40" y="76" fill="white" font-size="15" font-weight="700">前端展示层</text>
  <text x="700" y="76" fill="rgba(255,255,255,0.8)" font-size="11">React 19 + Vite 6</text>

  <rect x="20" y="100" width="760" height="40" rx="8" fill="url(#be)" filter="url(#shadow)"/>
  <text x="40" y="126" fill="white" font-size="15" font-weight="700">业务逻辑层</text>
  <text x="700" y="126" fill="rgba(255,255,255,0.8)" font-size="11">Zustand + React Router</text>

  <rect x="20" y="150" width="360" height="40" rx="8" fill="url(#db)" filter="url(#shadow)"/>
  <text x="40" y="176" fill="white" font-size="15" font-weight="700">本地数据层</text>
  <text x="340" y="176" fill="rgba(255,255,255,0.8)" font-size="11">Dexie (IndexedDB)</text>

  <rect x="420" y="150" width="360" height="40" rx="8" fill="url(#ai)" filter="url(#shadow)"/>
  <text x="440" y="176" fill="white" font-size="15" font-weight="700">AI 集成层</text>
  <text x="740" y="176" fill="rgba(255,255,255,0.8)" font-size="11">OpenAI / 多模型</text>

  <line x1="400" y1="120" x2="400" y2="150" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
  <polygon points="396,145 400,155 404,145" fill="#94a3b8"/>
  <line x1="240" y1="190" x2="240" y2="210" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="560" y1="190" x2="560" y2="210" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>

  <text x="240" y="230" fill="#64748b" font-size="12" text-anchor="middle">提示词 · 场景 · 版本 · 快照</text>
  <text x="560" y="230" fill="#64748b" font-size="12" text-anchor="middle">AI 优化 · 测试 · 质量分析</text>
</svg>
</div>

---

## 核心功能导览

### 提示词管理

| 功能 | 操作 | 快捷键 |
|------|------|--------|
| 新建提示词 | 侧边栏选择场景 → 点击"新建提示词" | — |
| 保存 | 编辑完成后点击保存按钮 | \`Ctrl + S\` |
| 复制内容 | 在详情页工具栏点击复制 | \`Ctrl + E\` |
| 删除提示词 | 详情页工具栏点击删除 | \`Ctrl + D\` |
| AI 优化 | 编辑器中点击 AI 优化 | \`Ctrl + I\` |

### 工作流程

<div align="center">
<svg viewBox="0 0 700 120" width="100%" max-width="650" xmlns="http://www.w3.org/2000/svg" style="background:#f8fafc;border-radius:12px;padding:12px;font-family:system-ui,sans-serif">
  <defs>
    <linearGradient id="c1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#818cf8"/></linearGradient>
    <linearGradient id="c2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient>
    <linearGradient id="c3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#34d399"/></linearGradient>
    <linearGradient id="c4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fbbf24"/></linearGradient>
    <linearGradient id="c5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#f87171"/></linearGradient>
  </defs>

  <rect x="10" y="20" width="110" height="70" rx="12" fill="url(#c1)" opacity="0.9"/>
  <text x="65" y="50" fill="white" font-size="13" font-weight="bold" text-anchor="middle">新建场景</text>
  <text x="65" y="70" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="middle">组织分类</text>

  <line x1="120" y1="55" x2="145" y2="55" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
  <polygon points="142,50 150,55 142,60" fill="#94a3b8"/>

  <rect x="150" y="20" width="110" height="70" rx="12" fill="url(#c2)" opacity="0.9"/>
  <text x="205" y="50" fill="white" font-size="13" font-weight="bold" text-anchor="middle">编写提示词</text>
  <text x="205" y="70" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="middle">Markdown 编辑</text>

  <line x1="260" y1="55" x2="285" y2="55" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
  <polygon points="282,50 290,55 282,60" fill="#94a3b8"/>

  <rect x="290" y="20" width="110" height="70" rx="12" fill="url(#c3)" opacity="0.9"/>
  <text x="345" y="50" fill="white" font-size="13" font-weight="bold" text-anchor="middle">测试验证</text>
  <text x="345" y="70" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="middle">多模型对比</text>

  <line x1="400" y1="55" x2="425" y2="55" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
  <polygon points="422,50 430,55 422,60" fill="#94a3b8"/>

  <rect x="430" y="20" width="110" height="70" rx="12" fill="url(#c4)" opacity="0.9"/>
  <text x="485" y="50" fill="white" font-size="13" font-weight="bold" text-anchor="middle">优化迭代</text>
  <text x="485" y="70" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="middle">AI 辅助优化</text>

  <line x1="540" y1="55" x2="565" y2="55" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,3"/>
  <polygon points="562,50 570,55 562,60" fill="#94a3b8"/>

  <rect x="570" y="20" width="110" height="70" rx="12" fill="url(#c5)" opacity="0.9"/>
  <text x="625" y="50" fill="white" font-size="13" font-weight="bold" text-anchor="middle">导出分享</text>
  <text x="625" y="70" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="middle">JSON / Agent</text>
</svg>
</div>

---

## 场景管理

- **创建场景**：侧边栏底部点击 "+" 按钮，设置名称、描述、颜色和图标
- **编辑场景**：右键场景卡片或点击编辑按钮
- **排序**：拖拽场景卡片调整顺序
- **颜色标识**：为不同项目设置不同颜色，快速区分

---

## 版本控制

每次保存提示词时自动创建新版本：

- 在详情页点击"版本历史"查看所有版本
- 每个版本记录完整内容快照
- **版本对比**：选择两个版本进行 diff 对比
- **版本回滚**：一键恢复到任一历史版本
- **版本保护**：锁定重要版本防止被自动清理

---

## AI 辅助功能

### 提示词优化

在编辑器中点击 AI 优化（\`Ctrl + I\`），输入优化目标，AI 会自动改进提示词结构和措辞。

### 质量分析

对提示词进行全面质量评估：
- 完整性评分
- 清晰度评分
- 可执行性评分
- 综合加权评分

### 多模型测试

同一个提示词在不同 AI 模型上的表现对比，支持：
- GPT-4 / GPT-4o
- Claude 3.5 Sonnet
- 自定义模型接入

---

## 标签与搜索

- **标签分类**：为提示词添加标签，多维度归类
- **标签联想**：系统根据内容智能推荐标签
- **全局搜索**：顶部搜索栏搜索所有提示词内容
- **高级筛选**：按标签、星标、日期范围组合筛选

---

## 数据管理

### 导出导入

- **导出**：将所有数据（场景 + 提示词 + 版本）导出为 JSON 文件
- **导出 Agent 工具**：将提示词导出为 AI Agent 工具配置格式
- **导入**：上传之前导出的 JSON 文件恢复数据

### 自动快照

系统每天自动创建数据快照，可在状态栏查看和管理快照历史。

---

## 嵌入式 SVG 画图

在提示词中直接嵌入 SVG 图形丰富表达：

\`\`\`html
<div align="center">
<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="50" height="50" rx="8" fill="#6366f1"/>
  <circle cx="130" cy="35" r="25" fill="#10b981"/>
  <text x="35" y="42" fill="white" font-size="14" text-anchor="middle">框</text>
  <text x="130" y="41" fill="white" font-size="14" text-anchor="middle">圆</text>
</svg>
</div>
\`\`\`

切换到 HTML 格式可实时预览 SVG 渲染效果。
`,
    isStarred: false,
    currentVersionId: '',
    tags: ['入门', '使用说明', '手册'],
    notes: '本产品的完整使用手册，帮助新用户快速上手并掌握全部功能',
    variables: [],
    createdAt: now,
    updatedAt: now,
  });
});

export async function migrateLegacyData(userId: string): Promise<void> {
  const unownedScenes = await db.scenes.filter((s) => !s.userId).toArray();
  if (unownedScenes.length === 0) return;
  await db.transaction('rw', db.scenes, db.prompts, async () => {
    for (const scene of unownedScenes) {
      await db.scenes.update(scene.id, { userId } as Partial<Scene>);
    }
    const unownedPrompts = await db.prompts.filter((p) => !p.userId).toArray();
    for (const prompt of unownedPrompts) {
      await db.prompts.update(prompt.id, { userId } as Partial<Prompt>);
    }
  });
}

export { db };