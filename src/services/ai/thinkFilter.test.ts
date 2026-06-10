import { describe, it, expect } from 'vitest';
import { stripThinkBlocks } from './thinkFilter';

describe('stripThinkBlocks', () => {
  it('passes clean text through unchanged', () => {
    const input = '这是正常的提示词输出内容';
    expect(stripThinkBlocks(input)).toBe(input);
  });

  it('strips DeepSeek R1 backslash format', () => {
    const input = '<\\think>这是模型思考过程<\\/think>这是最终答案';
    expect(stripThinkBlocks(input)).toBe('这是最终答案');
  });

  it('strips standard XML thinking block', () => {
    const input = '<thinking>model reasoning here</thinking>Final answer';
    expect(stripThinkBlocks(input)).toBe('Final answer');
  });

  it('strips think block (simplified tag)', () => {
    const input = '<think>reasoning</think>Final output';
    expect(stripThinkBlocks(input)).toBe('Final output');
  });

  it('strips thinking block with attributes', () => {
    const input = '<thinking duration="5s">reasoning</thinking>Final';
    expect(stripThinkBlocks(input)).toBe('Final');
  });

  it('strips bracket-format thinking block', () => {
    const input = '[THINKING]internal reasoning[/THINKING]Final answer';
    expect(stripThinkBlocks(input)).toBe('Final answer');
  });

  it('strips CJK full-width thinking block', () => {
    const input = '【思考】内部推理过程【/思考】最终答案';
    expect(stripThinkBlocks(input)).toBe('最终答案');
  });

  it('handles empty think block', () => {
    const input = '<think></think>Final';
    expect(stripThinkBlocks(input)).toBe('Final');
  });

  it('handles think block at start of text', () => {
    const input = '<think>r</think>The answer is 42';
    expect(stripThinkBlocks(input)).toBe('The answer is 42');
  });

  it('handles think block at end of text', () => {
    const input = 'The answer is 42<think>r</think>';
    expect(stripThinkBlocks(input)).toBe('The answer is 42');
  });

  it('handles multiple think blocks in same text', () => {
    const input = '<think>a</think>Part1<think>b</think>Part2';
    expect(stripThinkBlocks(input)).toBe('Part1Part2');
  });

  it('handles multiline think blocks', () => {
    const input = '<think>\nline 1\nline 2\n</think>\nFinal';
    expect(stripThinkBlocks(input)).toBe('Final');
  });

  it('case insensitive matching', () => {
    const input = '<THINK>reasoning</THINK>Final';
    expect(stripThinkBlocks(input)).toBe('Final');
  });

  it('trims whitespace after stripping', () => {
    const input = '<think>r</think>  \n  Final  ';
    expect(stripThinkBlocks(input)).toBe('Final');
  });

  it('handles empty string', () => {
    expect(stripThinkBlocks('')).toBe('');
  });

  it('does not strip text that looks like but is not a think tag', () => {
    const input = '请输出 <tag>格式</tag> 和 [LABEL]值[/LABEL]';
    expect(stripThinkBlocks(input)).toBe(input);
  });
});
