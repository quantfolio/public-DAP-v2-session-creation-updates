// Smoke test: hit every GET /api/* route against a running server and assert 2xx.
//
//   pnpm dev            # start the API (uses .env creds)
//   pnpm smoke          # in another terminal
//
// Env: SMOKE_BASE (default http://localhost:3000), SMOKE_SESSION_ID, and — if the
// server isn't already authenticated — dap_uri / dap_client_id / dap_client_secret.
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const SESSION = process.env.SMOKE_SESSION_ID ?? process.env.dap_session_id ?? "";

const ROUTES: { path: string; session?: boolean }[] = [
  { path: "/api/health" },
  { path: "/api/readme" },
  { path: "/api/auth/status" },
  { path: "/api/config/goal-types" },
  { path: "/api/config/goal-information" },
  { path: "/api/config/advisor-notes" },
  { path: "/api/config/sustainability" },
  { path: "/api/config/risk-question" },
  { path: "/api/config/goal-horizons" },
  { path: "/api/config/advice-information" },
  { path: "/api/config/financial-situation" },
  { path: "/api/config/countries" },
  { path: "/api/config/client-information" },
  { path: "/api/advisors" },
  { path: "/api/investors" },
  { path: "/api/advice-sessions?size=5" },
  { path: "/api/settings" },
  { path: "/api/goals", session: true },
  { path: "/api/financial-situation", session: true },
  { path: "/api/advice-information", session: true },
  { path: "/api/knowledge-and-experience", session: true },
  { path: "/api/risk-question", session: true },
  { path: "/api/sustainability", session: true },
];

async function ensureAuth(): Promise<void> {
  const status = await fetch(`${BASE}/api/auth/status`)
    .then((r) => r.json())
    .catch(() => null);
  if (status?.authenticated) return;

  const { dap_uri, dap_client_id, dap_client_secret } = process.env;
  if (!dap_client_id || !dap_client_secret) {
    console.error(
      "Not authenticated and no credentials in env. Start the server with a .env, " +
        "or authenticate in the UI, before running the smoke test.",
    );
    process.exit(1);
  }
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dap_uri, client_id: dap_client_id, client_secret: dap_client_secret }),
  });
  if (!res.ok) {
    console.error("Login failed:", await res.text());
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    await fetch(`${BASE}/api/health`);
  } catch {
    console.error(`Server not reachable at ${BASE}. Run \`pnpm dev\` first.`);
    process.exit(1);
  }
  await ensureAuth();

  let failed = 0;
  let skipped = 0;
  for (const r of ROUTES) {
    // Session-scoped routes need a session id (SMOKE_SESSION_ID / dap_session_id).
    if (r.session && !SESSION) {
      skipped++;
      console.log(`- skip          ${r.path} (set SMOKE_SESSION_ID to check)`);
      continue;
    }
    const url = r.session
      ? `${BASE}${r.path}${r.path.includes("?") ? "&" : "?"}session_id=${SESSION}`
      : `${BASE}${r.path}`;
    const start = Date.now();
    let status: number | string;
    try {
      status = (await fetch(url)).status;
    } catch {
      status = "ERR";
    }
    const ok = typeof status === "number" && status < 400;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${String(status).padEnd(4)} ${`${Date.now() - start}ms`.padStart(7)}  ${r.path}`);
  }

  const checked = ROUTES.length - skipped;
  console.log(`\n${checked - failed}/${checked} passed${skipped ? ` (${skipped} skipped — no session)` : ""}`);
  process.exit(failed ? 1 : 0);
}

void main();
