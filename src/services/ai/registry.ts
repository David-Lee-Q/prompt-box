import type { AIProvider } from './provider';
import type { AIProviderConfig } from '@/types/ai';

const registry = new Map<string, (config: AIProviderConfig) => AIProvider>();

export function registerProvider(format: string, factory: (config: AIProviderConfig) => AIProvider): void {
  registry.set(format, factory);
}

export function createProvider(config: AIProviderConfig): AIProvider {
  const factory = registry.get(config.format);
  if (!factory) throw new Error(`Unknown provider format: ${config.format}`);
  return factory(config);
}
