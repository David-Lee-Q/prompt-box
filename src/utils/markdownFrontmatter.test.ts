import { describe, it, expect } from 'vitest';
import { renderFrontmatterAsTable } from './markdownFrontmatter';

const BOOKMARKLET = `---
name: bookmarklet-install-button
description: Embed a floating drag-to-install
bookmarklet button in any web page, fixed at top-right and colored by the page
primary color. Use when reusing the drag-to-bookmark install pattern in another app.
---

# 拖拽安装书签浮窗按钮

在页面右上角渲染一个可拖拽到书签栏的按钮。
`;

const DEPLOY = `---
name: deploy-website
description: 部署并本地预览 Web 项目。
arguments:
  - name: workspace
    description: 要部署的工作区目录的绝对路径
    required: false
---

# 部署网站

自动检测项目类型并启动开发服务器。
`;

describe('renderFrontmatterAsTable', () => {
  it('标量键值转两列表格，多行纯量按空格折叠', () => {
    const out = renderFrontmatterAsTable(BOOKMARKLET);
    expect(out).toContain('<table>');
    expect(out).toContain('<tr><td>name</td><td>bookmarklet-install-button</td></tr>');
    expect(out).toContain(
      '<tr><td>description</td><td>Embed a floating drag-to-install bookmarklet button in any web page, fixed at top-right and colored by the page primary color. Use when reusing the drag-to-bookmark install pattern in another app.</td></tr>'
    );
    expect(out).toContain('# 拖拽安装书签浮窗按钮');
    expect(out).not.toContain('---');
  });

  it('嵌套结构保留为 YAML 代码块，标量仍转表格', () => {
    const out = renderFrontmatterAsTable(DEPLOY);
    expect(out).toContain('<tr><td>name</td><td>deploy-website</td></tr>');
    expect(out).toContain('<tr><td>description</td><td>部署并本地预览 Web 项目。</td></tr>');
    expect(out).toContain('\`\`\`yaml');
    expect(out).toContain('arguments:');
    expect(out).toContain('- name: workspace');
    expect(out).toContain('# 部署网站');
  });

  it('无 frontmatter 时原样返回', () => {
    const md = '# 标题\n\n普通内容\n\n---\n\n分隔线后的内容';
    expect(renderFrontmatterAsTable(md)).toBe(md);
  });

  it('开头有 --- 但无闭合 --- 时原样返回', () => {
    const md = '---\n只有开始没有结束\n\n# 标题';
    expect(renderFrontmatterAsTable(md)).toBe(md);
  });

  it('frontmatter 内无键值对时原样返回（不丢内容）', () => {
    const md = '---\njust some free text\nno key here\n---\n\n正文';
    expect(renderFrontmatterAsTable(md)).toBe(md);
  });

  it('幂等：二次调用结果不变', () => {
    const once = renderFrontmatterAsTable(BOOKMARKLET);
    expect(renderFrontmatterAsTable(once)).toBe(once);
  });

  it('值中的 HTML 特殊字符被转义', () => {
    const md = '---\nname: a<b & "c"\n---\n\n正文';
    const out = renderFrontmatterAsTable(md);
    expect(out).toContain('<td>a&lt;b &amp; &quot;c&quot;</td>');
    expect(out).not.toContain('<td>a<b');
  });

  it('去除标量值的成对引号', () => {
    const md = '---\nname: "带引号名称"\ndescription: \'单引号描述\'\n---\n\n正文';
    const out = renderFrontmatterAsTable(md);
    expect(out).toContain('<td>带引号名称</td>');
    expect(out).toContain('<td>单引号描述</td>');
  });

  it('保留正文中的 --- 分隔线', () => {
    const md = '---\nname: x\n---\n\n# 标题\n\n---\n\n尾部';
    const out = renderFrontmatterAsTable(md);
    expect(out).toContain('---\n\n尾部');
  });
});
