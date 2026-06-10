import { env } from "./env.js";
import { client } from "./client/client.gen.js";
import { postV1AuthToken } from "./client/sdk.gen.js";

// --- OAuth2 client-credentials token, cached in-memory ---------------------
//
// The token endpoint response only returns `access_token` (no `expires_in`),
// so we refresh on a conservative interval and also force-refresh on demand.
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes

let cachedToken: string | undefined;
let cachedAt = 0;
let inFlight: Promise<string> | undefined;

async function fetchToken(): Promise<string> {
  const { data, error } = await postV1AuthToken({
    body: {
      grant_type: "client_credentials",
      client_id: env.dapClientId,
      client_secret: env.dapClientSecret,
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
  const fresh = Date.now() - cachedAt < TOKEN_TTL_MS;
  if (!forceRefresh && cachedToken && fresh) {
    return cachedToken;
  }
  // De-dupe concurrent refreshes.
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

// --- Configure the generated client ----------------------------------------
// Point the client at the configured base URL and supply the bearer token via
// the `auth` callback. The generated SDK only invokes this for endpoints that
// declare the `token` security scheme, so the token endpoint won't recurse.
client.setConfig({
  baseUrl: env.dapUri,
  auth: () => getAccessToken(),
});

export { client };
