export type APIFormat = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  format: APIFormat;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AIProviderConfig {
  type: string;
  format: APIFormat;
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
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
