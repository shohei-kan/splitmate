// frontend/src/api/client.ts

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  // FormData のときは Content-Type を付けない（boundaryが必要）
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
  } else {
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(await formatApiError(res));
  }

  // 204 No Content 対策
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  // JSON以外でも読めるようにしておく（念のため）
  return (await res.text()) as unknown as T;
}

async function formatApiError(res: Response): Promise<string> {
  const statusLine = `HTTP ${res.status}`;

  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();
      const msg = stringifyDjangoErrors(data);
      return msg ? `${statusLine}: ${msg}` : statusLine;
    }
    const text = await res.text();
    const trimmed = text.trim();
    return trimmed ? `${statusLine}: ${trimmed}` : statusLine;
  } catch {
    return statusLine;
  }
}

/**
 * DRF/Djangoのエラー形式を「人間が読める1行」に寄せる
 * - {detail:"..."}
 * - {field:["..."]}
 * - {non_field_errors:["..."]}
 * - ネストや配列も再帰でつぶす
 */
function stringifyDjangoErrors(input: unknown): string {
  if (input == null) return "";

  // string
  if (typeof input === "string") return input;

  // array
  if (Array.isArray(input)) {
    return input
      .map((v) => stringifyDjangoErrors(v))
      .filter(Boolean)
      .join(" / ");
  }

  // object
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;

    // DRFの代表: detail
    if (typeof obj.detail === "string") return obj.detail;

    // non_field_errors もよくある
    if (obj.non_field_errors) {
      const nf = stringifyDjangoErrors(obj.non_field_errors);
      if (nf) return nf;
    }

    // field errors: { field: ["msg1", "msg2"], ... }
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const msg = stringifyDjangoErrors(v);
      if (!msg) continue;
      parts.push(`${k}: ${msg}`);
    }
    return parts.join(" / ");
  }

  // number/boolean/etc
  return String(input);
}