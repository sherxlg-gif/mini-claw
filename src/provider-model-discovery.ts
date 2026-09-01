import type { ProviderProtocol } from './runtime-config.js';

export type ProviderModelOption = {
  id: string;
  name: string;
};

export type ProviderModelDiscoveryInput = {
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
};

export function providerModelsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('请填写 API Endpoint');
  const parsed = new URL(`${normalized}/`);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('API Endpoint 必须使用 HTTP 或 HTTPS');
  }
  return new URL('models', parsed).toString();
}

function safeEndpointForError(endpoint: string): string {
  const parsed = new URL(endpoint);
  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function providerModelHeaders(
  input: ProviderModelDiscoveryInput,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(input.customHeaders || {}),
  };
  const hasExplicitAuth = Object.keys(headers).some((key) => {
    const normalized = key.toLowerCase();
    return normalized === 'authorization' || normalized === 'x-api-key';
  });
  if (input.apiKey?.trim() && !hasExplicitAuth) {
    if (input.protocol === 'anthropic-messages') {
      headers['x-api-key'] = input.apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers.Authorization = `Bearer ${input.apiKey.trim()}`;
    }
  }
  return headers;
}

export async function fetchProviderModels(
  input: ProviderModelDiscoveryInput,
): Promise<ProviderModelOption[]> {
  const endpoint = providerModelsUrl(input.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: providerModelHeaders(input),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `上游模型列表请求失败（HTTP ${response.status}，${safeEndpointForError(endpoint)}）`,
      );
    }
    const payload = (await response.json()) as unknown;
    const candidates = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object'
        ? Array.isArray((payload as { data?: unknown }).data)
          ? (payload as { data: unknown[] }).data
          : Array.isArray((payload as { models?: unknown }).models)
            ? (payload as { models: unknown[] }).models
            : []
        : [];
    const seen = new Set<string>();
    return candidates
      .map((item): ProviderModelOption | null => {
        if (typeof item === 'string') return { id: item, name: item };
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        if (!id) return null;
        const name =
          typeof record.display_name === 'string'
            ? record.display_name.trim()
            : typeof record.name === 'string'
              ? record.name.trim()
              : id;
        return { id, name: name || id };
      })
      .filter((item): item is ProviderModelOption => {
        if (!item || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  } finally {
    clearTimeout(timeout);
  }
}
