import type { ProviderCredential } from '@/db/schema';
import type { ProviderChunk, ProviderRunArgs } from '../types';
import { runOpenAI } from './openai';
import { runAnthropic } from './anthropic';
import { runGemini } from './gemini';

const GROK_BASE_URL = 'https://api.x.ai/v1';

/**
 * Maps a provider credential to the right streaming runner. Grok is
 * dispatched through the OpenAI runner with the xAI base URL — same
 * wire format, same tool/streaming protocol.
 */
export function streamProvider(
  credential: Pick<ProviderCredential, 'provider' | 'model' | 'baseUrl'>,
  rest: Omit<ProviderRunArgs, 'baseUrl' | 'model'>,
): AsyncIterable<ProviderChunk> {
  const args: ProviderRunArgs = {
    ...rest,
    baseUrl: credential.baseUrl,
    model: credential.model,
  };

  switch (credential.provider) {
    case 'openai':
      return runOpenAI(args);
    case 'grok':
      return runOpenAI({
        ...args,
        baseUrl: credential.baseUrl ?? GROK_BASE_URL,
      });
    case 'anthropic':
      return runAnthropic(args);
    case 'gemini':
      return runGemini(args);
    default: {
      const _: never = credential.provider;
      throw new Error(`Unknown provider: ${_ as string}`);
    }
  }
}

export const PROVIDER_DEFAULT_MODELS: Record<ProviderCredential['provider'], string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-1.5-flash',
  grok: 'grok-3-mini',
};
