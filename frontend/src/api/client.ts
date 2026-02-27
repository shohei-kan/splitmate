const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

function buildUrl(path: string) {
  return `${BASE_URL}${path}`;
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = buildUrl(path);

  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined;

  // JSON送信の時だけ Content-Type を付ける（GETにも付けない）
  if (hasBody && !headers.has("Content-Type") && !isFormData(options.body)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // JSON error / text error のどっちも拾う
    const ct = res.headers.get("content-type") ?? "";
    const payload = ct.includes("application/json")
      ? JSON.stringify(await res.json().catch(() => ({})))
      : await res.text().catch(() => "");

    throw new Error(`API error ${res.status}: ${payload || res.statusText}`);
  }

  // 204 No Content 対応
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}