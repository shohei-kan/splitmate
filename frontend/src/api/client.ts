const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function buildUrl(path: string) {
  // BASE_URLが空なら相対パス => Vite proxyが効く
  return `${BASE_URL}${path}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}
