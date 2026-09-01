import { beforeEach, describe, expect, test, vi } from 'vitest';

const runtimeConfig = vi.hoisted(() => ({
  protocol: 'openai-responses' as const,
  baseUrl: 'https://api.example.test/v1',
  apiKey: 'test-key',
  customHeaders: { 'X-Test': '1' },
  anthropicBaseUrl: '',
  anthropicApiKey: '',
  anthropicAuthToken: '',
  claudeCodeOauthToken: '',
  claudeOAuthCredentials: null,
  anthropicModel: 'gpt-5.6-terra',
  updatedAt: null,
}));

const registerProvider = vi.fn();
const getModel = vi.fn(() => ({ provider: 'miniclaw-anthropic', id: 'gpt-5.6-terra' }));
const setRuntimeApiKey = vi.fn();
const sessionSubscribe = vi.fn((listener: (event: unknown) => void) => {
  listener({
    type: 'message_update',
    assistantMessageEvent: { type: 'text_delta', delta: 'ok' },
  });
  return () => undefined;
});
const sessionPrompt = vi.fn(async () => undefined);

vi.mock('../src/runtime-config.js', () => ({
  getClaudeProviderConfig: () => runtimeConfig,
}));
vi.mock('../src/config.js', () => ({ DATA_DIR: 'data' }));
vi.mock('../src/logger.js', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@earendil-works/pi-coding-agent', () => ({
  ModelRuntime: {
    create: vi.fn(async () => ({
      registerProvider,
      getModel,
      getModels: vi.fn(() => []),
      setRuntimeApiKey,
    })),
  },
  SettingsManager: { create: vi.fn(() => ({})) },
  DefaultResourceLoader: class {
    async reload() {}
  },
  SessionManager: { inMemory: vi.fn(() => ({})) },
  createAgentSession: vi.fn(async () => ({
    session: {
      subscribe: sessionSubscribe,
      prompt: sessionPrompt,
      dispose: vi.fn(),
      abort: vi.fn(async () => undefined),
    },
  })),
}));

const { sdkQuery } = await import('../src/sdk-query.js');

beforeEach(() => {
  registerProvider.mockReset();
  getModel.mockClear();
  setRuntimeApiKey.mockReset();
  sessionSubscribe.mockClear();
  sessionPrompt.mockClear();
});

describe('sdkQuery provider resolution', () => {
  test('registers the selected OpenAI Responses protocol and unified API key', async () => {
    await expect(sdkQuery('return ok')).resolves.toBe('ok');

    expect(registerProvider).toHaveBeenCalledWith(
      'miniclaw-anthropic',
      expect.objectContaining({
        api: 'openai-responses',
        baseUrl: runtimeConfig.baseUrl,
        apiKey: runtimeConfig.apiKey,
        headers: runtimeConfig.customHeaders,
      }),
    );
  });
});
