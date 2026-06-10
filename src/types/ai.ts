export type APIFormat = 'openai' | 'anthropic';

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
