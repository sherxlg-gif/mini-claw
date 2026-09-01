import { describe, expect, test } from 'vitest';

import { resolveClaudeProviderRuntime } from '../container/agent-runner/src/provider-runtime.js';

describe('agent-runner provider model contract', () => {
  test.each([
    {
      name: 'official without model uses the SDK default',
      env: { MINICLAW_CLAUDE_ENDPOINT_KIND: 'official' },
      missingRequiredModel: false,
      queryModelOptions: {},
      usageModelKey: 'default',
    },
    {
      name: 'official with model passes the selected model',
      env: {
        MINICLAW_CLAUDE_ENDPOINT_KIND: 'official',
        ANTHROPIC_MODEL: 'sonnet',
      },
      missingRequiredModel: false,
      queryModelOptions: { model: 'sonnet' },
      usageModelKey: 'sonnet',
    },
    {
      name: 'custom endpoint without model fails fast',
      env: { MINICLAW_CLAUDE_ENDPOINT_KIND: 'custom' },
      missingRequiredModel: true,
      queryModelOptions: {},
      usageModelKey: 'default',
    },
    {
      name: 'custom endpoint with model passes the selected model',
      env: {
        MINICLAW_CLAUDE_ENDPOINT_KIND: 'custom',
        ANTHROPIC_MODEL: 'glm-5.2',
      },
      missingRequiredModel: false,
      queryModelOptions: { model: 'glm-5.2' },
      usageModelKey: 'glm-5.2',
    },
  ])(
    '$name',
    ({ env, missingRequiredModel, queryModelOptions, usageModelKey }) => {
      const runtime = resolveClaudeProviderRuntime(env);

      expect(runtime.missingRequiredModel).toBe(missingRequiredModel);
      expect(runtime.queryModelOptions).toEqual(queryModelOptions);
      expect(runtime.usageModelKey).toBe(usageModelKey);
    },
  );

  test('authoritative official marker ignores an inherited stale base URL', () => {
    const runtime = resolveClaudeProviderRuntime({
      MINICLAW_CLAUDE_ENDPOINT_KIND: 'official',
      ANTHROPIC_BASE_URL: 'https://stale-proxy.test',
    });

    expect(runtime.endpointKind).toBe('official');
    expect(runtime.missingRequiredModel).toBe(false);
  });

  test('falls back to base URL detection for older hosts', () => {
    expect(
      resolveClaudeProviderRuntime({
        ANTHROPIC_BASE_URL: 'https://proxy.test',
      }).endpointKind,
    ).toBe('custom');
  });

  test('uses the unified provider model for OpenAI-compatible hosts', () => {
    const runtime = resolveClaudeProviderRuntime({
      MINICLAW_CLAUDE_ENDPOINT_KIND: 'custom',
      MINICLAW_PROVIDER_PROTOCOL: 'openai-chat-completions',
      MINICLAW_PROVIDER_BASE_URL: 'https://api.deepseek.com/v1',
      MINICLAW_PROVIDER_MODEL: 'deepseek-chat',
    });

    expect(runtime.model).toBe('deepseek-chat');
    expect(runtime.queryModelOptions).toEqual({ model: 'deepseek-chat' });
    expect(runtime.missingRequiredModel).toBe(false);
    expect(runtime.endpointKind).toBe('custom');
  });

  test.each([
    ['openai-chat-completions', 'https://api.deepseek.com/v1', 'deepseek-chat'],
    ['openai-responses', 'https://api.example.test/v1', 'codex-mini'],
    ['anthropic-messages', 'https://api.example.test/anthropic', 'claude-sonnet'],
  ] as const)('preserves selected protocol %s', (protocol, baseUrl, model) => {
    const runtime = resolveClaudeProviderRuntime({
      MINICLAW_CLAUDE_ENDPOINT_KIND: 'custom',
      MINICLAW_PROVIDER_PROTOCOL: protocol,
      MINICLAW_PROVIDER_BASE_URL: baseUrl,
      ANTHROPIC_MODEL: model,
    });

    expect(runtime.protocol).toBe(protocol);
    expect(runtime.model).toBe(model);
    expect(runtime.missingRequiredModel).toBe(false);
  });
});
