export function resolveApiBaseUrl(rawApiUrl?: string): string {
  const value = (rawApiUrl ?? import.meta.env?.VITE_API_URL ?? '').trim();
  if (!value) {
    return '/api/v1';
  }

  const trimmed = value.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

export function buildApiUrl(path: string, rawApiUrl?: string): string {
  const base = resolveApiBaseUrl(rawApiUrl);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function resolveWebSocketUrl(options?: {
  rawWsUrl?: string;
  rawApiUrl?: string;
  locationProtocol?: string;
  locationHost?: string;
}): string {
  const rawWsUrl = (options?.rawWsUrl ?? import.meta.env?.VITE_WS_URL ?? '').trim();
  if (rawWsUrl) {
    const trimmed = rawWsUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/ws/notifications')) {
      return trimmed;
    }
    return `${trimmed}/ws/notifications`;
  }

  const rawApiUrl = (options?.rawApiUrl ?? import.meta.env?.VITE_API_URL ?? '').trim();
  if (rawApiUrl && /^https?:\/\//i.test(rawApiUrl)) {
    const parsed = new URL(rawApiUrl);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsed.host}/ws/notifications`;
  }

  const protocol =
    options?.locationProtocol ??
    (typeof window !== 'undefined' ? window.location.protocol : 'http:');
  const host =
    options?.locationHost ??
    (typeof window !== 'undefined' ? window.location.host : 'localhost:3000');
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}/ws/notifications`;
}

export const API_BASE_URL = resolveApiBaseUrl();
