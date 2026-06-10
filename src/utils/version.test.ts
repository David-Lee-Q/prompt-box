import { describe, it, expect } from 'vitest';
import { generateNextVersion, compareVersions } from './version';

describe('generateNextVersion', () => {
  it('generates version from undefined (patch bump from base)', () => {
    // generateNextVersion always bumps patch; initial v1.0.0 is set by savePrompt service
    const v = generateNextVersion(undefined);
    expect(v).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('generates v1.0.1 from v1.0.0', () => {
    expect(generateNextVersion('v1.0.0')).toBe('v1.0.1');
  });

  it('generates patch bump from v2.3.5', () => {
    expect(generateNextVersion('v2.3.5')).toBe('v2.3.6');
  });

  it('handles v0.0.0 edge case', () => {
    expect(generateNextVersion('v0.0.0')).toBe('v0.0.1');
  });
});

describe('compareVersions', () => {
  it('returns negative when a < b', () => {
    expect(compareVersions('v1.0.0', 'v1.0.1')).toBeLessThan(0);
  });

  it('returns positive when a > b', () => {
    expect(compareVersions('v2.0.0', 'v1.9.9')).toBeGreaterThan(0);
  });

  it('returns 0 when a == b', () => {
    expect(compareVersions('v1.0.0', 'v1.0.0')).toBe(0);
  });

  it('compares major version correctly', () => {
    expect(compareVersions('v2.0.0', 'v1.99.99')).toBeGreaterThan(0);
  });

  it('compares minor version correctly', () => {
    expect(compareVersions('v1.5.0', 'v1.4.99')).toBeGreaterThan(0);
  });
});
