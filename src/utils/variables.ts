import type { VariableDef } from '@/types';

const VAR_RE = /\{\{(\w+)(?::(\w+))?(?::([^}]+))?\}\}/g;

export function extractVariables(content: string): VariableDef[] {
  const seen = new Set<string>();
  const vars: VariableDef[] = [];
  for (const m of content.matchAll(VAR_RE)) {
    const name = m[1]!;
    if (seen.has(name)) continue;
    seen.add(name);
    const rawType = m[2];
    const validTypes = ['text', 'textarea', 'number', 'boolean', 'select'];
    const type = (rawType && validTypes.includes(rawType) ? rawType : 'text') as VariableDef['type'];
    const opts = m[3];
    const def: VariableDef = { name, type };
    if (type === 'number' && opts) {
      const [min, max] = opts.split(',').map(Number);
      if (min !== undefined && !isNaN(min)) def.min = min;
      if (max !== undefined && !isNaN(max)) def.max = max;
    } else if (type === 'select' && opts) {
      def.options = opts.split(',').map((s) => s.trim());
    }
    vars.push(def);
  }
  return vars;
}
