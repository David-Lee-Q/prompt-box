import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  containsChinese,
  parseSkillMarkdown,
  pickSkillName,
  pickSkillDescription,
  parseSkillFile,
} from './skillFileParser';

const TYPICAL_SKILL = `---
name: deploy-website
description: 部署并本地预览 Web 项目。自动检测项目类型，启动对应的开发服务器。
arguments:
  - name: workspace
    description: 要部署的工作区目录的绝对路径
    required: false
---

# 部署网站

自动检测项目类型，在后台启动对应的开发服务器。

## 项目类型检测逻辑

1. **Node.js Web 项目**
   - 查找 package.json
`;

describe('containsChinese', () => {
  it('识别中文字符', () => {
    expect(containsChinese('部署网站')).toBe(true);
    expect(containsChinese('English only')).toBe(false);
    expect(containsChinese('')).toBe(false);
  });
});

describe('parseSkillMarkdown', () => {
  it('解析 frontmatter 的 name/description 与正文 H1', () => {
    const parts = parseSkillMarkdown(TYPICAL_SKILL);
    expect(parts.fmName).toBe('deploy-website');
    expect(parts.fmDescription).toBe('部署并本地预览 Web 项目。自动检测项目类型，启动对应的开发服务器。');
    expect(parts.h1).toBe('部署网站');
    expect(parts.firstParagraph).toBe('自动检测项目类型，在后台启动对应的开发服务器。');
  });

  it('无 frontmatter 时从正文解析 H1 与首段', () => {
    const parts = parseSkillMarkdown('# 代码审查\n\n审查代码的正确性与安全性。\n\n## 细节\n\n内容');
    expect(parts.fmName).toBe('');
    expect(parts.h1).toBe('代码审查');
    expect(parts.firstParagraph).toBe('审查代码的正确性与安全性。');
  });

  it('跳过代码块中的 # 行与分隔线', () => {
    const parts = parseSkillMarkdown('# 标题\n\n段落一\n\n```\n# 不是标题\n```\n\n---\n\n后面的段落');
    expect(parts.h1).toBe('标题');
    expect(parts.firstParagraph).toBe('段落一');
  });
});

describe('pickSkillName', () => {
  it('H1 为中文时优先使用 H1', () => {
    expect(pickSkillName('deploy-website', '部署网站')).toBe('部署网站');
  });

  it('H1 非中文而 frontmatter name 为中文时取 frontmatter', () => {
    expect(pickSkillName('技能名称', 'Deploy Website')).toBe('技能名称');
  });

  it('都非中文时优先 H1', () => {
    expect(pickSkillName('my-skill', 'My Skill')).toBe('My Skill');
    expect(pickSkillName('my-skill', '')).toBe('my-skill');
    expect(pickSkillName('', 'H1 Only')).toBe('H1 Only');
  });
});

describe('pickSkillDescription', () => {
  it('frontmatter 描述为中文时直接使用', () => {
    expect(pickSkillDescription('中文描述', 'English paragraph')).toBe('中文描述');
  });

  it('frontmatter 描述非中文时回退到正文首段（中文）', () => {
    expect(pickSkillDescription('English desc', '中文首段')).toBe('中文首段');
  });

  it('都非中文时优先 frontmatter', () => {
    expect(pickSkillDescription('English desc', 'English para')).toBe('English desc');
    expect(pickSkillDescription('', '中文首段')).toBe('中文首段');
  });
});

describe('parseSkillFile', () => {
  it('直接解析 .md 文件', async () => {
    const file = new File([TYPICAL_SKILL], 'deploy-website.md', { type: 'text/markdown' });
    const result = await parseSkillFile(file);
    expect(result.name).toBe('部署网站');
    expect(result.description).toBe('部署并本地预览 Web 项目。自动检测项目类型，启动对应的开发服务器。');
    expect(result.content).toContain('# 部署网站');
    expect(result.sourceName).toBe('deploy-website.md');
  });

  it('解析 zip 包中的 SKILL.md（含子目录）', async () => {
    const zip = new JSZip();
    zip.file('deploy-website/SKILL.md', TYPICAL_SKILL);
    zip.file('deploy-website/scripts/run.sh', 'echo hi');
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'deploy-website.zip');
    const result = await parseSkillFile(file);
    expect(result.name).toBe('部署网站');
    expect(result.description).toContain('部署并本地预览');
    expect(result.sourceName).toBe('deploy-website.zip');
  });

  it('zip 中有多个 SKILL.md 时取路径最浅的', async () => {
    const zip = new JSZip();
    zip.file('a/b/SKILL.md', '# 深层技能\n\n深层描述。');
    zip.file('SKILL.md', '# 顶层技能\n\n顶层描述。');
    const blob = await zip.generateAsync({ type: 'blob' });
    const result = await parseSkillFile(new File([blob], 'skill.zip'));
    expect(result.name).toBe('顶层技能');
    expect(result.description).toBe('顶层描述。');
  });

  it('zip 中没有 SKILL.md 时抛错', async () => {
    const zip = new JSZip();
    zip.file('README.md', '# readme');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseSkillFile(new File([blob], 'bad.zip'))).rejects.toThrow('未找到 SKILL.md');
  });

  it('不支持的文件类型抛错', async () => {
    await expect(parseSkillFile(new File(['x'], 'skill.txt'))).rejects.toThrow('不支持的文件类型');
  });
});
