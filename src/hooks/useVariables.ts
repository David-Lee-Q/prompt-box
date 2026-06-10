import { useMemo } from 'react';
import { extractVariables } from '@/utils/variables';
import type { VariableDef } from '@/types';

export interface VariableInfo {
  name: string;
  value: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select';
  options?: string[];
  min?: number;
  max?: number;
}

export { extractVariables };

export function renderTemplate(template: string, variables: VariableInfo[]): string {
  let result = template;
  for (const v of variables) {
    // Match {{name}} or {{name:type}} or {{name:type:opts}}
    const re = new RegExp(`\\{\\{${escapeRegExp(v.name)}(:[^}]*)?\\}\\}`, 'g');
    result = result.replace(re, v.value || `{{${v.name}}}`);
  }
  return result;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function useVariables(content: string) {
  return useMemo(() => {
    const defs: VariableDef[] = extractVariables(content);
    return {
      hasVariables: defs.length > 0,
      variableDefs: defs,
      variableNames: defs.map((d) => d.name),
    };
  }, [content]);
}
