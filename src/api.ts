import { env } from "./env.js";
import { client } from "./client/client.gen.js";
import { postV1AuthToken } from "./client/sdk.gen.js";
import { clearSettingsCache } from "./dap-settings.js";

// --- Credentials, settable at runtime (login) with .env as the default ------
interface Credentials {
  uri: string;
  clientId: string;
  clientSecret: string;
}

const DEFAULT_URI = "https://api.test.deepalpha.dev";

let credentials: Credentials | null =
  env.dapUri && env.dapClientId && env.dapClientSecret
    ? { uri: env.dapUri, clientId: env.dapClientId, clientSecret: env.dapClientSecret }
    : null;

// --- OAuth2 client-credentials token, cached in-memory ----------------------
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes
let cachedToken: string | undefined;
let cachedAt = 0;
let inFlight: Promise<string> | undefined;

function resetToken() {
  cachedToken = undefined;
  cachedAt = 0;
  inFlight = undefined;
}

async function fetchToken(): Promise<string> {
  if (!credentials) throw new Error("Not authenticated: no client credentials set");
  const { data, error } = await postV1AuthToken({
    baseUrl: credentials.uri,
    body: {
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    },
  });
  if (error || !data?.access_token) {
    throw new Error(
      `Failed to obtain access token: ${JSON.stringify(error ?? "no access_token in response")}`,
    );
  }
  return data.access_token;
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!credentials) throw new Error("Not authenticated");
  const fresh = Date.now() - cachedAt < TOKEN_TTL_MS;
  if (!forceRefresh && cachedToken && fresh) return cachedToken;
  inFlight ??= fetchToken()
    .then((token) => {
      cachedToken = token;
      cachedAt = Date.now();
      return token;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

function mask(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** Set credentials and verify them by fetching a token. Throws on failure. */
export async function login(uri: string, clientId: string, clientSecret: string): Promise<void> {
  credentials = { uri: uri || DEFAULT_URI, clientId, clientSecret };
  resetToken();
  clearSettingsCache(); // tenant may have changed
  client.setConfig({ baseUrl: credentials.uri, auth: () => getAccessToken() });
  await getAccessToken(true); // verify
}

export function logout(): void {
  credentials = null;
  resetToken();
  clearSettingsCache();
}

export function authStatus() {
  return {
    authenticated: Boolean(credentials),
    uri: credentials?.uri ?? null,
    clientId: credentials ? mask(credentials.clientId) : null,
  };
}

// Initial client config (uses .env defaults if present).
client.setConfig({
  baseUrl: credentials?.uri ?? DEFAULT_URI,
  auth: () => getAccessToken(),
});

// Capture request bodies so a retried request (below) can be replayed.
const pendingBodies = new WeakMap<Request, string>();
client.interceptors.request.use(async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    try {
      pendingBodies.set(request, await request.clone().text());
    } catch {
      /* body not clonable — skip replay */
    }
  }
  return request;
});

// On a 401 the cached token may have expired or been revoked: refresh it and
// retry the request once. The token endpoint itself is excluded to avoid loops.
client.interceptors.response.use(async (response, request, opts) => {
  if (
    response.status !== 401 ||
    request.url.includes("/auth/token") ||
    request.headers.get("x-da-retried")
  ) {
    return response;
  }
  resetToken();
  let token: string;
  try {
    token = await getAccessToken(true);
  } catch {
    return response;
  }
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-da-retried", "1");
  const body = pendingBodies.get(request);
  const doFetch = (opts as { fetch?: typeof fetch })?.fetch ?? fetch;
  return doFetch(
    new Request(request.url, {
      method: request.method,
      headers,
      ...(body !== undefined ? { body } : {}),
    }),
  );
});

export { client };
