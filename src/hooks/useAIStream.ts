import { useState, useRef, useCallback, useEffect } from 'react';
import type { AIStreamChunk } from '@/types/ai';

interface UseAIStreamOptions {
  onText?: (text: string) => void;
  onError?: (error: string) => void;
  onDone?: (fullText: string) => void;
}

export function useAIStream(options: UseAIStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const startStream = useCallback(
    async (
      streamFn: (
        onChunk: (chunk: AIStreamChunk) => void,
        signal: AbortSignal
      ) => Promise<string>
    ) => {
      setIsStreaming(true);
      setError(null);
      const controller = new AbortController();
      abortRef.current = controller;
      const { onText, onError, onDone } = optionsRef.current;

      try {
        let accumulated = '';
        await streamFn((chunk: AIStreamChunk) => {
          if (chunk.type === 'text') {
            accumulated += chunk.content;
            onText?.(chunk.content);
          } else if (chunk.type === 'error') {
            setError(chunk.content);
            onError?.(chunk.content);
          }
        }, controller.signal);

        onDone?.(accumulated);
        return accumulated;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return '';
        const msg = err instanceof Error ? err.message : '请求失败';
        setError(msg);
        onError?.(msg);
        return '';
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isStreaming, error, startStream, abort };
}
