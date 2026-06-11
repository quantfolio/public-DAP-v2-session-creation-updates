export type UpstreamRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
};

export type ApiResult = {
  method: string;
  path: string;
  url: string;
  requestBody?: unknown;
  status: number | string;
  body: unknown;
  // Round-trip latency in milliseconds.
  ms?: number;
  // The real DeepAlpha request the server made (auth redacted), if reported.
  upstream?: UpstreamRequest;
};

// Extract a short human-readable error from a failed result, or null if it's OK.
export function errorMessage(r: ApiResult): string | null {
  if (typeof r.status === "number" && r.status < 400) return null;
  if (typeof r.status === "string") return String(r.body || r.status); // network error
  const body = r.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return `HTTP ${r.status}`;
  const err = (body.error ?? body) as Record<string, unknown>;
  const codes = (body.error_codes ?? err.error_codes) as unknown;
  const msg =
    (typeof err.message === "string" && err.message) ||
    (Array.isArray(codes) && codes.join(", ")) ||
    (typeof err.detail === "string" && err.detail) ||
    null;
  return msg ? `HTTP ${r.status}: ${msg}` : `HTTP ${r.status}`;
}

// Render the request as the real DeepAlpha call when the server reported it,
// otherwise fall back to the proxy request (auth applied server-side).
export function formatRequest(r: ApiResult): string {
  const lines: string[] = [];
  if (r.upstream) {
    lines.push(`${r.upstream.method} ${r.upstream.url}`);
    for (const [k, v] of Object.entries(r.upstream.headers)) lines.push(`${k}: ${v}`);
    if (r.requestBody !== undefined) lines.push("", JSON.stringify(r.requestBody, null, 2));
  } else {
    lines.push(`${r.method} ${r.url}`, "Authorization: Bearer [REDACTED]");
    if (r.requestBody !== undefined) {
      lines.push("Content-Type: application/json", "", JSON.stringify(r.requestBody, null, 2));
    }
  }
  return lines.join("\n");
}

export async function apiCall(
  method: string,
  path: string,
  sessionId: string,
  body?: unknown,
): Promise<ApiResult> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}session_id=${encodeURIComponent(sessionId)}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    let upstream: UpstreamRequest | undefined;
    const header = res.headers.get("x-upstream-request");
    if (header) {
      try {
        upstream = JSON.parse(decodeURIComponent(header));
      } catch {
        /* ignore */
      }
    }
    const ms = Math.round(performance.now() - start);
    return { method, path, url, requestBody: body, status: res.status, body: parsed, ms, upstream };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    return { method, path, url, requestBody: body, status: "network error", body: String(err), ms };
  }
}
