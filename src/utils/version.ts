export type VersionBump = 'major' | 'minor' | 'patch';

export function generateNextVersion(
  lastVersion: string = 'v1.0.0',
  bump: VersionBump = 'patch'
): string {
  const [maj, min, pat] = lastVersion
    .replace('v', '')
    .split('.')
    .map(Number);

  const major = maj ?? 0;
  const minor = min ?? 0;
  const patch = pat ?? 0;

  switch (bump) {
    case 'major': return `v${major + 1}.0.0`;
    case 'minor': return `v${major}.${minor + 1}.0`;
    case 'patch': return `v${major}.${minor}.${patch + 1}`;
  }
}

export function compareVersions(a: string, b: string): number {
  const [aMaj = '0', aMin = '0', aPatch = '0'] = a.replace('v', '').split('.');
  const [bMaj = '0', bMin = '0', bPatch = '0'] = b.replace('v', '').split('.');
  return Number(aMaj) - Number(bMaj) || Number(aMin) - Number(bMin) || Number(aPatch) - Number(bPatch);
}
