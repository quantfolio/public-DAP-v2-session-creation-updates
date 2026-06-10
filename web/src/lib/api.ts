export type ApiResult = {
  method: string;
  path: string;
  url: string;
  requestBody?: unknown;
  status: number | string;
  body: unknown;
};

export async function apiCall(
  method: string,
  path: string,
  sessionId: string,
  body?: unknown,
): Promise<ApiResult> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}session_id=${encodeURIComponent(sessionId)}`;
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
    return { method, path, url, requestBody: body, status: res.status, body: parsed };
  } catch (err) {
    return { method, path, url, requestBody: body, status: "network error", body: String(err) };
  }
}
