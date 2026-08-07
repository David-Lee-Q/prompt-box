export type APIFormat = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  format: APIFormat;
  apiKey: string;
  baseUrl: string;
  model: string;
  /** 内置模型标识：内置模型(系统预置)的 apiKey 加密存储，用户自定义 provider 不加密 */
  builtIn?: boolean;
}

export interface AIProviderConfig {
  type: string;
  format: APIFormat;
  apiKey: string;
  baseUrl?: string;
  model: string;
  builtIn?: boolean;
}

export interface AISettings {
  providers: ProviderConfig[];
  activeProviderId: string | null;
}

export interface AIStreamChunk {
  type: 'text' | 'error' | 'done';
  content: string;
}

export interface OptimizeDimension {
  key: string;
  label: string;
  score: number;
  enabled: boolean;
  findings: string;
}

export interface AIOptimizeRequest {
  content: string;
  instruction?: string;
  context?: string;
  dimensions?: OptimizeDimension[];
}

export interface AIOptimizeResponse {
  optimized: string;
  explanation?: string;
}

// ── Agent Tool Export ──

export type AgentExportFormat = 'openai-fc' | 'anthropic-tools' | 'openai-sdk' | 'langchain';

export interface AgentExportResult {
  format: AgentExportFormat;
  content: string;
  filename: string;
}

export interface AgentToolConfig {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

export interface AnthropicToolConfig {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}
