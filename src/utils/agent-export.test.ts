import { describe, it, expect } from 'vitest';
import { safeName, variableToJsonSchema, buildSchema, exportAsAgentTool } from './agent-export';
import type { VariableDef } from '@/types';

describe('safeName', () => {
  it('passes plain names through', () => {
    expect(safeName('testTool')).toBe('testTool');
  });

  it('replaces spaces with underscores', () => {
    expect(safeName('my tool name')).toBe('my_tool_name');
  });

  it('strips special chars', () => {
    expect(safeName('tool-name!@#')).toBe('tool_name___');
  });

  it('falls back to tool for empty input', () => {
    expect(safeName('')).toBe('tool');
  });
});

describe('variableToJsonSchema', () => {
  it('maps text to string', () => {
    const v: VariableDef = { name: 'query', type: 'text' };
    expect(variableToJsonSchema(v)).toEqual({ type: 'string', description: '参数: query' });
  });

  it('maps number with range', () => {
    const v: VariableDef = { name: 'count', type: 'number', min: 1, max: 100 };
    expect(variableToJsonSchema(v)).toEqual({ type: 'number', description: '参数: count', minimum: 1, maximum: 100 });
  });

  it('maps boolean', () => {
    const v: VariableDef = { name: 'verbose', type: 'boolean' };
    expect(variableToJsonSchema(v)).toEqual({ type: 'boolean', description: '参数: verbose' });
  });

  it('maps select with enum', () => {
    const v: VariableDef = { name: 'lang', type: 'select', options: ['en', 'zh'] };
    expect(variableToJsonSchema(v)).toEqual({ type: 'string', description: '参数: lang', enum: ['en', 'zh'] });
  });
});

describe('buildSchema', () => {
  it('adds default input param for prompt without variables', () => {
    const schema = buildSchema({ prompt: { name: 'test', content: 'no vars' } });
    expect(schema.properties).toHaveProperty('input');
    expect(schema.required).toContain('input');
  });

  it('creates properties for each variable', () => {
    const content = 'Translate {{source}} code to {{target:text}} with {{verbose:boolean}}';
    const schema = buildSchema({ prompt: { name: 'test', content } });
    expect(Object.keys(schema.properties)).toContain('source');
    expect(Object.keys(schema.properties)).toContain('target');
    expect(Object.keys(schema.properties)).toContain('verbose');
    expect(schema.required).toContain('source');
    expect(schema.required).toContain('target');
    expect(schema.required).not.toContain('verbose'); // boolean excluded from required
  });

  it('maps variable types to JSON Schema correctly', () => {
    const content = '用 {{tone:select:formal,casual}} 语气写 {{topic}}，最多 {{count:number:1,10}} 条';
    // Note: extractVariables regex uses \w+ which matches ASCII word chars in {{name}} pattern
    const schema = buildSchema({ prompt: { name: 'test', content } });
    expect(schema.properties).toHaveProperty('tone');
    expect(schema.properties).toHaveProperty('topic');
    expect(schema.properties).toHaveProperty('count');
    const toneDef = schema.properties['tone'] as { enum?: string[] };
    expect(toneDef?.enum).toEqual(['formal', 'casual']);
  });
});

describe('exportAsAgentTool', () => {
  const prompt = { name: '代码翻译器', content: '将 {{source}} 代码翻译为 {{target}}' };

  it('generates valid OpenAI function calling JSON', () => {
    const r = exportAsAgentTool(prompt, 'openai-fc');
    const parsed = JSON.parse(r.content);
    expect(parsed.type).toBe('function');
    expect(parsed.function.parameters.type).toBe('object');
    expect(parsed.function.parameters.required).toContain('source');
  });

  it('generates valid Anthropic tools JSON', () => {
    const r = exportAsAgentTool(prompt, 'anthropic-tools');
    const parsed = JSON.parse(r.content);
    expect(parsed.name).toBeTruthy();
    expect(parsed.input_schema.type).toBe('object');
  });

  it('generates OpenAI SDK TypeScript', () => {
    const r = exportAsAgentTool(prompt, 'openai-sdk');
    expect(r.content).toContain("import OpenAI from 'openai'");
    expect(r.content).toContain('const ');
    expect(r.content).toContain('Tool = {');
    expect(r.filename).toMatch(/\.ts$/);
  });

  it('generates LangChain TypeScript', () => {
    const r = exportAsAgentTool(prompt, 'langchain');
    expect(r.content).toContain('@langchain/core/tools');
    expect(r.content).toContain('extends StructuredTool');
    expect(r.content).toContain('async _call');
  });

  it('includes handler placeholder when requested', () => {
    const r = exportAsAgentTool(prompt, 'openai-sdk', true);
    expect(r.content).toContain('TODO: implement');
  });

  it('does not include handler by default', () => {
    const r = exportAsAgentTool(prompt, 'openai-sdk', false);
    expect(r.content).not.toContain('TODO: implement');
  });
});
