# P2-6：WebDAV 云端备份

> 2026-06-09

## Context

当前项目只有本地 JSON 文件导出/导入（通过浏览器下载），无远程同步能力。用户无法在多台设备间保持提示词数据一致。WebDAV 是开放的 HTTP 协议，用户可以自建服务（NAS、NextCloud、群晖）或使用 WebDAV 云服务，不绑定特定厂商。

## 现状追踪

### 已有基础设施

```
导出: exportAllData()                            — src/utils/export-import.ts:26-37
  格式: { version, exportedAt, scenes[], prompts[], versions[] }
  输出: JSON Blob → 浏览器下载

导入: importData(jsonText, strategy)             — src/utils/export-import.ts:127-217
  策略: skip / overwrite / rename
  冲突检测: detectConflicts(data)                — :110-125  (按 id 匹配)
  事务: db.transaction('rw', scenes, prompts, versions)

数据层: Dexie IndexedDB                          — src/db/index.ts
  3 张表: scenes, prompts, versions
  所有记录有 id (业务主键) 和 updatedAt (时间戳)

快照: createSnapshot()                           — src/utils/snapshot.ts:14-47
  自动存 localStorage，保留最近 3 个
```

### 关键缺口

- 无任何网络请求相关的存储/同步代码
- 所有 ID 通过 `generateId()` 生成（业务主键），没有 UUID
- 没有增量同步或版本向量
- 没有"上次同步时间"追踪

## 目标行为

1. AI 设置对话框增加"云端备份"Tab
2. 支持配置 WebDAV 服务器（URL + 用户名 + 密码）
3. 手动备份：点击按钮 → 导出全量数据 → 推送到 WebDAV
4. 手动恢复：列出远程备份列表 → 选择并下载 → 导入到本地
5. 自动备份（可选开关）：按间隔（如每次保存后、每小时）自动推送
6. 显示备份时间线（本地 + 远程）

## 实现方案

### 1. 新增 WebDAV 服务模块

**新建 `src/services/cloud/webdavService.ts`**：

```ts
// WebDAV 操作封装（直接 HTTP，不引入额外依赖）
interface WebDAVConfig {
  url: string;       // https://dav.example.com/remote.php/dav/files/user/
  username: string;
  password: string;
}

// 核心方法
async function testConnection(config: WebDAVConfig): Promise<boolean>;
async function listBackups(config: WebDAVConfig): Promise<BackupInfo[]>;
async function uploadBackup(config: WebDAVConfig, data: ExportData): Promise<void>;
async function downloadBackup(config: WebDAVConfig, filename: string): Promise<ExportData>;
async function deleteBackup(config: WebDAVConfig, filename: string): Promise<void>;
```

实现细节：
- 使用 `fetch()` 发送 WebDAV 请求（PROPFIND、PUT、GET、DELETE）
- `PROPFIND` 列出 `/AI-Prompt-Manager-Backup/` 目录下的 `.json` 文件
- `PUT` 上传备份文件
- `GET` 下载备份文件
- 基础认证通过 `Authorization: Basic {base64(user:pass)}` 头
- 超时 30 秒

### 2. 配置存储

**新增 `src/types/cloud.ts`**：

```ts
export interface CloudConfig {
  id: string;
  name: string;
  type: 'webdav';
  url: string;
  username: string;
  password: string;     // 明文存 localStorage（后续可优化为加密）
  autoBackup: boolean;
  autoBackupInterval: 'on_save' | 'hourly' | 'daily';
  lastSyncAt: number | null;
  enabled: boolean;
}
```

**存储位置**：`localStorage` key `'ai-prompt-manager-cloud-configs'`（独立于 AI settings 存储）。

### 3. UI：云备份配置面板

**新建 `src/components/settings/CloudBackupSettings.tsx`**：

```
┌─ 云端备份
├─ [添加 WebDAV 服务器] 按钮
├─ 已配置的服务器列表（卡片形式）:
│  ├─ 服务器名称 + URL
│  ├─ [测试连接] [立即备份] [恢复备份] [删除]
│  └─ 上次同步时间显示
└─ 备份历史列表（时间线）
```

配置表单：
- 名称（自定义，如"公司 NAS"）
- WebDAV 地址
- 用户名
- 密码（`type="password"` 输入框）
- 自动备份开关
- 自动备份间隔选择

### 4. 备份/恢复流程

**备份流程**：
```
1. 用户点击"立即备份"或自动触发
2. exportAllDataForCloud() → 收集 scenes/prompts/versions + 序列化
3. webdavService.uploadBackup() → PUT 到远程
4. 更新 lastSyncAt
5. toast 提示结果
```

**恢复流程**：
```
1. 用户点击"恢复备份"
2. webdavService.listBackups() → 显示远程备份列表（时间、大小）
3. 用户选择一个备份
4. webdavService.downloadBackup() → 下载 JSON
5. 验证数据格式（复用 validateImportData）
6. 如果本地有冲突 → 显示冲突对话框（复用 detectConflicts）
7. 用户选择策略 → importData()
8. 刷新页面数据 → toast 提示
```

### 5. 自动备份逻辑

**`src/services/cloud/autoBackup.ts`**：

```ts
// 在每次保存提示词后检查
export async function maybeAutoBackup(): Promise<void> {
  const configs = getEnabledAutoBackupConfigs();
  for (const config of configs) {
    if (config.autoBackupInterval === 'on_save') {
      await performBackup(config);
    }
  }
}

// 定时器检查（App 启动时注册）
export function startAutoBackupScheduler(): void {
  setInterval(async () => {
    const configs = getEnabledAutoBackupConfigs();
    for (const config of configs) {
      if (shouldBackupNow(config)) {
        await performBackup(config);
      }
    }
  }, 60_000); // 每分钟检查一次
}
```

在 `src/services/promptService.ts` 的 `savePrompt` 成功后调用 `maybeAutoBackup()`。

### 6. 安全性考虑

| 风险 | 应对 |
|------|------|
| 密码明文存 localStorage | 标注为 P2 已知限制，后续可用 Web Crypto API 加密 |
| HTTP 传输中间人 | 要求用户使用 HTTPS WebDAV 地址 |
| 备份覆盖远程数据 | 备份文件带时间戳命名，不覆盖旧备份 |
| 恢复覆盖本地未保存数据 | 恢复前自动创建本地快照（复用 snapshot.ts） |

## 文件变更

| 文件 | 改动 |
|------|------|
| `src/services/cloud/webdavService.ts` | **新建** — WebDAV CRUD 操作 |
| `src/services/cloud/autoBackup.ts` | **新建** — 自动备份调度 |
| `src/types/cloud.ts` | **新建** — CloudConfig 类型 |
| `src/components/settings/CloudBackupSettings.tsx` | **新建** — 配置面板 UI |
| `src/components/settings/AISettings.tsx` | 增加"云端备份"Tab |
| `src/services/promptService.ts` | savePrompt 后调用 maybeAutoBackup |
| `src/utils/export-import.ts` | validateImportData 导出供恢复流程使用 |

## 验证

1. 配置一个 WebDAV 服务器 → 测试连接成功
2. 点击"立即备份" → 远程出现备份文件
3. 在另一浏览器导入数据 → 点击"恢复备份" → 选择远程文件 → 数据恢复到本地
4. 自动备份开启 → 保存提示词后自动触发 → 远程文件更新
5. WebDAV 地址错误 → 测试连接失败 → 显示友好错误提示
6. 恢复时本地数据冲突 → 显示冲突对话框 → 选择策略后正确合并

---

## 评审发现与修订 (2026-06-09)

### 1. CORS 未处理（最大部署障碍）

**问题**：浏览器中 `fetch()` 发 PROPFIND/PUT/DELETE 到 WebDAV 服务器会触发 CORS 预检。大部分自建 NAS 未开启 CORS。

**修正**：复用现有 Vite 代理模式（`/api/proxy` 中间件），增加 WebDAV 代理路由。或在文档中明确要求用户配置反向代理，并在连接测试中检测 CORS 错误给出明确提示。

### 2. ExportData 不含 AI 配置

**问题**：`ExportData` 只有 scenes/prompts/versions，缺少 `ProviderConfig[]`（API Key 等）。云备份恢复后 AI 设置丢失。

**修正**：扩展 `ExportData` 类型加入 `aiSettings?: AISettings` 字段。备份/恢复时读写该字段。

### 3. 自动备份耦合 savePrompt 可能阻塞保存

**问题**：`savePrompt` 内 `await maybeAutoBackup()` 让网络 I/O 阻塞保存流程。

**修正**：改为 fire-and-forget 模式 — `maybeAutoBackup()` 返回 void，内部用 `.catch()` 静默处理错误。保存完成后异步触发备份，不阻塞 UI。

### 4. AISettings 加 Tab 需要重构对话框

**问题**：`AISettings.tsx` 是单用途对话框，无 Tab 结构。

**修正**：在 `DialogContent` 内增加 `<Tabs>` 组件（shadcn/ui），Tab 1 "AI 提供商"，Tab 2 "云端备份"。宽度从 `max-w-lg` 调整到 `max-w-2xl`。
