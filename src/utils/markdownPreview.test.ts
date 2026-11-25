import { describe, it, expect } from 'vitest';
import {
  splitByFences,
  transformNonFenceSegment,
  prepareMarkdownPreview,
} from './markdownPreview';

const BOOKMARK_SNIPPET = `<!-- 拖拽本按钮到书签栏即可安装 -->
<script id="bm-code" type="text/plain">(function(){/* 浮窗逻辑 */})();</script>
<!-- 安装逻辑脚本 -->
<script src="js/bookmarklet-install.js"></script>`;

describe('splitByFences', () => {
  it('按顺序连接各段可无损还原原文', () => {
    const md = '前言\n```js\ncode <script>\n```\n后记\n';
    const joined = splitByFences(md).map((s) => s.content).join('\n');
    expect(joined).toBe(md);
  });

  it('围栏内内容标记 inFence，定界行单独成段', () => {
    const md = 'a\n```js\ncode\n```\nb';
    const segs = splitByFences(md);
    const byContent = (c: string) => segs.find((s) => s.content === c);
    expect(byContent('a')?.inFence).toBe(false);
    expect(byContent('```js')?.delimiter).toBe(true);
    expect(byContent('code')?.inFence).toBe(true);
    expect(byContent('b')?.inFence).toBe(false);
  });

  it('支持 ~~~ 围栏', () => {
    const segs = splitByFences('a\n~~~\ncode\n~~~\nb');
    expect(segs.find((s) => s.content === 'code')?.inFence).toBe(true);
    expect(segs.find((s) => s.content === 'b')?.inFence).toBe(false);
  });

  it('缩进 4 格的行不是围栏', () => {
    const segs = splitByFences('a\n    indented code\nb');
    expect(segs.every((s) => !s.delimiter)).toBe(true);
    expect(segs.every((s) => !s.inFence)).toBe(true);
  });
});

describe('transformNonFenceSegment', () => {
  it('script 块转为 html 代码块且原文完整保留', () => {
    const out = transformNonFenceSegment(BOOKMARK_SNIPPET);
    expect(out).toContain('```html');
    expect(out).toContain('<script id="bm-code" type="text/plain">(function(){/* 浮窗逻辑 */})();</script>');
    expect(out).toContain('<script src="js/bookmarklet-install.js"></script>');
    const fenceCount = (out.match(/```html/g) ?? []).length;
    expect(fenceCount).toBe(2);
  });

  it('HTML 注释转为可见文本并转义', () => {
    const out = transformNonFenceSegment(BOOKMARK_SNIPPET);
    expect(out).toContain('拖拽本按钮到书签栏即可安装');
    expect(out).toContain('安装逻辑脚本');
    expect(out).not.toContain('<!--');
    expect(out).not.toContain('-->');
  });

  it('注释中的特殊字符被转义', () => {
    const out = transformNonFenceSegment('a <!-- <b> & "q" > --> b');
    expect(out).toContain('&lt;b&gt; &amp; &quot;q&quot; &gt;');
    expect(out).not.toContain('<b>');
  });

  it('注释内的 script 文本整体转义，不再二次转代码块', () => {
    const out = transformNonFenceSegment('示例：<!-- <script>evil()</script> -->');
    expect(out).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(out).not.toContain('```html');
  });

  it('空注释被移除', () => {
    const out = transformNonFenceSegment('a <!-- --> b');
    expect(out).not.toContain('<!--');
  });

  it('未闭合注释原样保留', () => {
    expect(transformNonFenceSegment('a <!-- 未闭合 b')).toBe('a <!-- 未闭合 b');
  });

  it('无注释无脚本时原样返回', () => {
    const md = '普通 **加粗** 内容\n\n列表项';
    expect(transformNonFenceSegment(md)).toBe(md);
  });
});

describe('prepareMarkdownPreview', () => {
  it('书签脚本片段：script 可见、注释可见', () => {
    const out = prepareMarkdownPreview(BOOKMARK_SNIPPET);
    expect(out).toContain('```html');
    expect(out).toContain('<script id="bm-code"');
    expect(out).toContain('<script src="js/bookmarklet-install.js"></script>');
    expect(out).toContain('拖拽本按钮到书签栏即可安装');
    expect(out).not.toContain('<!--');
  });

  it('用户代码围栏内的 script/注释保持原样（不重复包裹）', () => {
    const md = '说明\n```html\n<script>in-fence()</script>\n<!-- 围栏内注释 -->\n```\n结尾';
    const out = prepareMarkdownPreview(md);
    const fenceBody = out.split('```')[1] ?? '';
    expect(fenceBody).toContain('<script>in-fence()</script>');
    expect(fenceBody).toContain('<!-- 围栏内注释 -->');
    // 仅原有 1 个围栏，script 未被额外包裹
    expect((out.match(/```html/g) ?? []).length).toBe(1);
  });

  it('frontmatter 与 script 同时存在时都正确转换', () => {
    const md = `---
name: bookmarklet-install-button
description: 拖拽安装书签浮窗按钮
---

# 拖拽安装书签浮窗按钮

${BOOKMARK_SNIPPET}`;
    const out = prepareMarkdownPreview(md);
    expect(out).toContain('<tr><td>name</td><td>bookmarklet-install-button</td></tr>');
    expect(out).toContain('```html');
    expect(out).toContain('拖拽本按钮到书签栏即可安装');
    expect(out).not.toContain('---\nname');
  });

  it('围栏外的普通 markdown 内容保留', () => {
    const out = prepareMarkdownPreview('# 标题\n\n**加粗** 与 `行内代码`\n\n- 列表项');
    expect(out).toContain('# 标题');
    expect(out).toContain('**加粗**');
    expect(out).toContain('- 列表项');
  });

  it('空字符串返回空字符串', () => {
    expect(prepareMarkdownPreview('')).toBe('');
  });

  it('幂等：二次处理结果不变', () => {
    const once = prepareMarkdownPreview(BOOKMARK_SNIPPET);
    expect(prepareMarkdownPreview(once)).toBe(once);

    const md = '---\nname: x\ndescription: y\n---\n\n```js\ncode\n```\n\n<script>a()</script>\n<!-- 注释 -->';
    const once2 = prepareMarkdownPreview(md);
    expect(prepareMarkdownPreview(once2)).toBe(once2);
  });
});
