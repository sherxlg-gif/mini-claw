import { describe, expect, test } from 'vitest';

import {
  UnifiedProviderCreateSchema,
  UnifiedProviderPatchSchema,
} from '../src/schemas.js';
import {
  buildContainerEnvLines,
  type ClaudeProviderConfig,
} from '../src/runtime-config.js';

const baseConfig = (patch: Partial<ClaudeProviderConfig> = {}): ClaudeProviderConfig => ({
  protocol: 'openai-chat-completions',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'test-key',
  anthropicBaseUrl: 'https://api.deepseek.com/v1',
  anthropicAuthToken: '',
  anthropicApiKey: '',
  claudeCodeOauthToken: '',
  claudeOAuthCredentials: null,
  anthropicModel: 'deepseek-chat',
  updatedAt: null,
  ...patch,
});

describe('multi-provider API contracts', () => {
  test.each(['openai-chat-completions', 'openai-responses'] as const)(
    'accepts %s with an endpoint, model and API key',
    (protocol) => {
      const result = UnifiedProviderCreateSchema.safeParse({
        name: protocol,
        type: 'third_party',
        protocol,
        baseUrl: 'https://api.example.test/v1',
        model: 'gpt-5-mini',
        apiKey: 'test-key',
      });
      expect(result.success).toBe(true);
    },
  );

  test('rejects an invalid endpoint and an empty OpenAI model', () => {
    const result = UnifiedProviderCreateSchema.safeParse({
      name: 'invalid',
      type: 'third_party',
      protocol: 'openai-chat-completions',
      baseUrl: 'file:///tmp/provider',
      model: '   ',
      apiKey: 'test-key',
    });
    expect(result.success).toBe(false);
  });

  test('rejects an empty patch', () => {
    expect(UnifiedProviderPatchSchema.safeParse({}).success).toBe(false);
  });

  test('injects OpenAI-compatible runtime variables without Claude defaults', () => {
    const lines = buildContainerEnvLines(baseConfig(), {}, {});
    expect(lines).toContain('MINICLAW_PROVIDER_PROTOCOL=openai-chat-completions');
    expect(lines).toContain('OPENAI_BASE_URL=https://api.deepseek.com/v1');
    expect(lines).toContain('OPENAI_MODEL=deepseek-chat');
    expect(lines).toContain('OPENAI_API_KEY=test-key');
    expect(lines.some((line) => line.startsWith('CLAUDE_CODE_'))).toBe(false);
    expect(lines.some((line) => line.startsWith('ANTHROPIC_DEFAULT_'))).toBe(false);
  });
});
