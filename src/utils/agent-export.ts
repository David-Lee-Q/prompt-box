import { extractVariables } from '@/utils/variables';
import type { VariableDef, Prompt, Version } from '@/types';
import type { AgentExportFormat, AgentExportResult } from '@/types/ai';

interface ExportOptions {
  prompt: Pick<Prompt, 'name' | 'content'>;
  version?: Pick<Version, 'version'>;
  includeHandler?: boolean;
}

function safeName(name: string): string {
  // Strip non-alphanumeric/underscore, keep Chinese chars, fallback to 'tool'
  const cleaned = name.trim().replace(/[^\w一-鿿]/g, '_') || 'tool';
  return cleaned;
}

function variableToJsonSchema(v: VariableDef): Record<string, unknown> {
  const base: Record<string, unknown> = { description: `参数: ${v.name}` };
  switch (v.type) {
    case 'number':
      base.type = 'number';
      if (v.min != null) base.minimum = v.min;
      if (v.max != null) base.maximum = v.max;
      break;
    case 'boolean':
      base.type = 'boolean';
      break;
    case 'select':
      base.type = 'string';
      if (v.options?.length) base.enum = v.options;
      break;
    default: // text, textarea
      base.type = 'string';
  }
  return base;
}

function buildSchema(options: ExportOptions): {
  properties: Record<string, unknown>;
  required: string[];
} {
  const vars = extractVariables(options.prompt.content);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  if (vars.length === 0) {
    // No variables — add a default "input" parameter
    properties['input'] = { type: 'string', description: '用户输入' };
    required.push('input');
  } else {
    for (const v of vars) {
      properties[v.name] = variableToJsonSchema(v);
      if (v.type !== 'boolean') required.push(v.name); // booleans have natural default
    }
  }

  return { properties, required };
}

function functionName(options: ExportOptions): string {
  return safeName(options.prompt.name).replace(/[一-鿿]+/g, 'tool').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'prompt_tool';
}

// ── Format exporters ──

function exportOpenAIFC(options: ExportOptions): AgentExportResult {
  const schema = buildSchema(options);
  const name = functionName(options);
  const config = {
    type: 'function',
    function: {
      name,
      description: options.prompt.content.trim().slice(0, 1024),
      parameters: {
        type: 'object',
        properties: schema.properties,
        required: schema.required,
      },
    },
  };
  return {
    format: 'openai-fc',
    content: JSON.stringify(config, null, 2),
    filename: `${name}_function.json`,
  };
}

function exportAnthropicTools(options: ExportOptions): AgentExportResult {
  const schema = buildSchema(options);
  const name = functionName(options);
  const config = {
    name,
    description: options.prompt.content.trim().slice(0, 1024),
    input_schema: {
      type: 'object',
      properties: schema.properties,
      required: schema.required,
    },
  };
  return {
    format: 'anthropic-tools',
    content: JSON.stringify(config, null, 2),
    filename: `${name}_tool.json`,
  };
}

function exportOpenAISDK(options: ExportOptions): AgentExportResult {
  const schema = buildSchema(options);
  const name = functionName(options);
  const fcName = safeName(options.prompt.name);
  const lines: string[] = [];
  lines.push("import OpenAI from 'openai';");
  lines.push('');
  lines.push('const openai = new OpenAI();');
  lines.push('');
  lines.push(`const ${name}Tool = {`);
  lines.push('  type: \'function\' as const,');
  lines.push('  function: {');
  lines.push(`    name: '${fcName}',`);
  lines.push(`    description: '${options.prompt.content.trim().slice(0, 200).replace(/'/g, "\\'")}',`);
  lines.push('    parameters: {');
  lines.push('      type: \'object\' as const,');
  lines.push(`      properties: ${JSON.stringify(schema.properties, null, 6).replace(/^/gm, '      ').trimStart()},`);
  lines.push(`      required: ${JSON.stringify(schema.required)} as const,`);
  lines.push('    },');
  lines.push('  },');
  lines.push('};');
  lines.push('');
  if (options.includeHandler) {
    lines.push(`async function ${name}Handler(args: Record<string, unknown>) {`);
    lines.push('  // TODO: implement your logic here');
    lines.push('  throw new Error(\'Not implemented\');');
    lines.push('}');
    lines.push('');
  }
  lines.push('// Usage:');
  lines.push(`// const response = await openai.chat.completions.create({`);
  lines.push(`//   model: 'gpt-4o',`);
  lines.push(`//   messages: [{ role: 'user', content: '...' }],`);
  lines.push(`//   tools: [${name}Tool],`);
  lines.push('// });');

  return {
    format: 'openai-sdk',
    content: lines.join('\n'),
    filename: `${name}_tool.ts`,
  };
}

function exportLangChain(options: ExportOptions): AgentExportResult {
  const schema = buildSchema(options);
  const name = functionName(options);
  const className = name.charAt(0).toUpperCase() + name.slice(1).replace(/_./g, (m) => m[1]!.toUpperCase());
  const lines: string[] = [];
  lines.push("import { StructuredTool } from '@langchain/core/tools';");
  lines.push("import { z } from 'zod';");
  lines.push('');
  lines.push(`const schema = z.object({`);
  for (const [key, def] of Object.entries(schema.properties)) {
    const d = def as { type?: string; enum?: string[]; description?: string; minimum?: number; maximum?: number };
    let zodType: string;
    switch (d.type) {
      case 'number': zodType = 'z.number()'; break;
      case 'boolean': zodType = 'z.boolean()'; break;
      default:
        zodType = d.enum?.length
          ? `z.enum([${d.enum.map((o) => `'${o}'`).join(', ')}])`
          : 'z.string()';
    }
    if (d.description) zodType += `.describe('${d.description}')`;
    lines.push(`  ${key}: ${zodType},`);
  }
  lines.push('});');
  lines.push('');
  lines.push(`export class ${className} extends StructuredTool {`);
  lines.push('  name = ' + JSON.stringify(safeName(options.prompt.name)) + ';');
  lines.push(`  description = ${JSON.stringify(options.prompt.content.trim().slice(0, 500))};`);
  lines.push('  schema = schema;');
  lines.push('');
  lines.push('  async _call(input: z.infer<typeof schema>): Promise<string> {');
  if (options.includeHandler) {
    lines.push('    // TODO: implement your logic using input');
    lines.push('    throw new Error(\'Not implemented\');');
  } else {
    lines.push('    // Use input to run your prompt against an AI model');
    lines.push('    return JSON.stringify(input);');
  }
  lines.push('  }');
  lines.push('}');

  return {
    format: 'langchain',
    content: lines.join('\n'),
    filename: `${name}_tool.ts`,
  };
}

const exporters: Record<AgentExportFormat, (o: ExportOptions) => AgentExportResult> = {
  'openai-fc': exportOpenAIFC,
  'anthropic-tools': exportAnthropicTools,
  'openai-sdk': exportOpenAISDK,
  'langchain': exportLangChain,
};

export function exportAsAgentTool(
  prompt: Pick<Prompt, 'name' | 'content'>,
  format: AgentExportFormat,
  includeHandler = false,
  version?: Pick<Version, 'version'>
): AgentExportResult {
  return exporters[format]({ prompt, version, includeHandler });
}

export { safeName, variableToJsonSchema, buildSchema };
