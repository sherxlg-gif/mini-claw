import { afterEach, describe, expect, test, vi } from 'vitest';

import { ProviderModelDiscoverySchema } from '../src/schemas.js';
import {
  fetchProviderModels,
  type ProviderModelDiscoveryInput,
} from '../src/provider-model-discovery.js';

const openAiInput = (
  patch: Partial<ProviderModelDiscoveryInput> = {},
): ProviderModelDiscoveryInput => ({
  protocol: 'openai-chat-completions',
  baseUrl: 'https://relay.example.test/v1',
  apiKey: 'temporary-key',
  customHeaders: {},
  ...patch,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('provider model discovery', () => {
  test('accepts unsaved form credentials', () => {
    expect(ProviderModelDiscoverySchema.safeParse(openAiInput()).success).toBe(
      true,
    );
  });

  test('rejects discovery without a saved provider or temporary key', () => {
    expect(
      ProviderModelDiscoverySchema.safeParse({
        protocol: 'openai-chat-completions',
        baseUrl: 'https://relay.example.test/v1',
      }).success,
    ).toBe(false);
  });

  test('allows an existing provider to reuse its saved credentials', () => {
    expect(
      ProviderModelDiscoverySchema.safeParse({
        providerId: 'saved-provider',
        protocol: 'openai-responses',
        baseUrl: 'https://relay.example.test/v1',
      }).success,
    ).toBe(true);
  });

  test('fetches and normalizes OpenAI models from the unsaved endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-5.6', name: 'GPT 5.6' },
            { id: 'gpt-5.6' },
            { id: 'deepseek-chat' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProviderModels(openAiInput())).resolves.toEqual([
      { id: 'deepseek-chat', name: 'deepseek-chat' },
      { id: 'gpt-5.6', name: 'GPT 5.6' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.test/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer temporary-key',
        }),
      }),
    );
  });

  test('uses Anthropic authentication without adding OpenAI authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchProviderModels(
      openAiInput({
        protocol: 'anthropic-messages',
        baseUrl: 'https://anthropic-relay.example.test',
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://anthropic-relay.example.test/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'temporary-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
  });
});
