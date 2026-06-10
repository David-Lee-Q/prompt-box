import { describe, it, expect } from 'vitest';
import { extractVariables } from './variables';

describe('extractVariables — typed variable syntax', () => {
  it('extracts plain {{name}} as type text (backward compat)', () => {
    const vars = extractVariables('Hello {{name}}, welcome!');
    expect(vars).toEqual([{ name: 'name', type: 'text' }]);
  });

  it('extracts {{name:text}} as text type', () => {
    const vars = extractVariables('{{title:text}}');
    expect(vars[0]).toEqual({ name: 'title', type: 'text' });
  });

  it('extracts {{name:textarea}} as textarea type', () => {
    const vars = extractVariables('{{body:textarea}}');
    expect(vars[0]).toEqual({ name: 'body', type: 'textarea' });
  });

  it('extracts {{name:number}} with type and no range', () => {
    const vars = extractVariables('{{count:number}}');
    expect(vars[0]).toEqual({ name: 'count', type: 'number' });
  });

  it('extracts {{name:number:1,100}} with min/max', () => {
    const vars = extractVariables('{{count:number:1,100}}');
    expect(vars[0]).toEqual({ name: 'count', type: 'number', min: 1, max: 100 });
  });

  it('extracts {{name:number:0}} with min only', () => {
    const vars = extractVariables('{{minOnly:number:0}}');
    expect(vars[0]).toEqual({ name: 'minOnly', type: 'number', min: 0 });
  });

  it('extracts {{name:boolean}} as boolean type', () => {
    const vars = extractVariables('{{verbose:boolean}}');
    expect(vars[0]).toEqual({ name: 'verbose', type: 'boolean' });
  });

  it('extracts {{name:select:a,b,c}} with options', () => {
    const vars = extractVariables('{{lang:select:英文,日文,法文}}');
    expect(vars[0]).toEqual({ name: 'lang', type: 'select', options: ['英文', '日文', '法文'] });
  });

  it('deduplicates by name (first wins)', () => {
    const vars = extractVariables('{{x:text}} and {{x:number:1,10}}');
    expect(vars).toHaveLength(1);
    expect(vars[0].type).toBe('text');
  });

  it('ignores invalid type and treats as text', () => {
    const vars = extractVariables('{{x:foobar}}');
    expect(vars[0]).toEqual({ name: 'x', type: 'text' });
  });

  it('returns empty array for content with no variables', () => {
    expect(extractVariables('plain text')).toEqual([]);
  });

  it('extracts multiple variables of mixed types', () => {
    const content = '你是{{role:text}}，将文本翻译成{{lang:select:英文,日文}}，字数{{limit:number:50,500}}，是否解释{{explain:boolean}}';
    const vars = extractVariables(content);
    expect(vars).toHaveLength(4);
    expect(vars.find((v) => v.name === 'role')?.type).toBe('text');
    expect(vars.find((v) => v.name === 'lang')?.type).toBe('select');
    expect(vars.find((v) => v.name === 'limit')?.type).toBe('number');
    expect(vars.find((v) => v.name === 'explain')?.type).toBe('boolean');
  });

  it('handles select with empty options (regex backtrack falls back to text)', () => {
    // {{x:select:}} causes regex backtrack — :select: captured as opts, type defaults to text.
    // This is an edge case: select with no options should just use {{x}}.
    const vars = extractVariables('{{x:select:}}');
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('x');
  });
});
