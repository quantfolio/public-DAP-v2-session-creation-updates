import { Router, type Response } from "express";
import { readFile } from "node:fs/promises";
import { adviceSession } from "./advice-session.js";
import {
  getV1Advisor,
  getV1Investor,
  getV1InvestorByInvestorId,
  postV1Investor,
  postV2AdviceSession,
} from "./client/sdk.gen.js";
import { DEFAULT_SESSION_ID, DEFAULT_GOAL_TYPE } from "./constants.js";
import { parseAnswers } from "./knowledge-and-experience.js";
import {
  adviceInformationConfig,
  financialSituationConfig,
  goalTypesConfig,
  goalInformationConfig,
  riskQuestionConfig,
  sustainabilityConfig,
  advisorNotesConfig,
  goalHorizonConfig,
  countriesConfig,
  clientInformationConfig,
  languagesConfig,
  getAllSettings,
} from "./dap-settings.js";
import { login, logout, authStatus } from "./api.js";
import { buildEndpointCsv } from "./export-csv.js";

export const router = Router();

// --- Auth (client credentials supplied at runtime via the UI) ---------------
router.get("/auth/status", (_req, res) => {
  res.json(authStatus());
});

router.post("/auth/login", async (req, res) => {
  const { dap_uri, client_id, client_secret } = req.body ?? {};
  if (typeof client_id !== "string" || typeof client_secret !== "string") {
    res.status(400).json({ error: "`client_id` and `client_secret` are required" });
    return;
  }
  try {
    await login(typeof dap_uri === "string" ? dap_uri : "", client_id, client_secret);
    res.json({ ok: true, ...authStatus() });
  } catch (err) {
    logout();
    res.status(401).json({ error: (err as Error).message });
  }
});

router.post("/auth/logout", (_req, res) => {
  logout();
  res.json({ ok: true, ...authStatus() });
});

// Require authentication for everything except health and auth routes
// (config routes fetch the authenticated tenant's settings, so they need auth too).
router.use((req, res, next) => {
  if (/\/(health|auth|readme)(\/|$)/.test(req.path) || authStatus().authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated. Log in with client credentials first." });
});

// Selected UI language from ?lang= (falls back to English).
function langOf(req: { query: Record<string, unknown> }): string {
  const l = req.query.lang;
  return typeof l === "string" && l ? l : "en";
}

// --- Form config derived from the tenant's live settings (/v2/settings/deepalpha).
// These require auth (they fetch the authenticated tenant's settings).
router.get("/config/languages", async (_req, res) => {
  try {
    res.json(await languagesConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/goal-types", async (req, res) => {
  try {
    res.json(await goalTypesConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/goal-information", async (req, res) => {
  try {
    res.json(await goalInformationConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/advisor-notes", async (_req, res) => {
  try {
    res.json(await advisorNotesConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/sustainability", async (req, res) => {
  try {
    res.json(await sustainabilityConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/risk-question", async (req, res) => {
  try {
    res.json(await riskQuestionConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/countries", async (_req, res) => {
  try {
    res.json(await countriesConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/client-information", async (req, res) => {
  try {
    res.json(await clientInformationConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/goal-horizons", async (req, res) => {
  try {
    res.json(await goalHorizonConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/advice-information", async (req, res) => {
  try {
    res.json(await adviceInformationConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/financial-situation", async (req, res) => {
  try {
    res.json(await financialSituationConfig(langOf(req)));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// Resolve the advice session id from the `session_id` query param, falling back
// to the hardcoded default. Lets the dev-tool UI drive which session is used.
function sessionId(req: { query: Record<string, unknown> }): string {
  const fromQuery = req.query.session_id;
  return typeof fromQuery === "string" && fromQuery.length > 0
    ? fromQuery
    : DEFAULT_SESSION_ID;
}

// Send the SDK result to the client, and echo the *real* upstream DeepAlpha
// request (method, full v2 URL, headers — bearer redacted) as a response header
// so the dev tool can show the actual call it made, not just the proxy hop.
function relay(
  res: Response,
  result: { data?: unknown; error?: unknown; request?: Request; response?: { status?: number } },
  successStatus = 200,
) {
  const { data, error, request, response } = result;
  if (request) {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = key.toLowerCase() === "authorization" ? "Bearer [REDACTED]" : value;
    });
    res.setHeader(
      "X-Upstream-Request",
      encodeURIComponent(JSON.stringify({ method: request.method, url: request.url, headers })),
    );
  }
  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.status(successStatus).json(data);
}

router.get("/health", (_req, res) => {
  res.json({ status: "healthy", uptime: process.uptime() });
});

// Integration guide (raw markdown) — surfaced in the dev tool's Docs view.
router.get("/readme", async (_req, res) => {
  try {
    res.type("text/markdown").send(await readFile("README.md", "utf8"));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Setup: advisors, investors (v1), session (v2) --------------------------
type InvestorBody = NonNullable<Parameters<typeof postV1Investor>[0]>["body"];
type SessionBody = NonNullable<Parameters<typeof postV2AdviceSession>[0]>["body"];

router.get("/advisors", async (_req, res) => {
  relay(res, await getV1Advisor());
});

router.get("/investors", async (_req, res) => {
  relay(res, await getV1Investor());
});

// Create an investor. Body (StateInvestorPayload): requires `country`, `investorType`.
router.post("/investors", async (req, res) => {
  relay(res, await postV1Investor({ body: (req.body ?? {}) as InvestorBody }), 201);
});

// Create an advice session (v2). Body (SessionCreateRequestSchemaV2): requires
// `advisor_id`, `investor_id`, `name`; optional `advice_type` (mifid | order_execution).
router.post("/sessions", async (req, res) => {
  relay(res, await postV2AdviceSession({ body: (req.body ?? {}) as SessionBody }), 201);
});

// Resolve the investor type ("person" | "company") of the active session's investor,
// so forms can infer their subject.
router.get("/session-investor", async (req, res) => {
  const sess = await adviceSession.get({ path: { session_id: sessionId(req) } });
  const sessData = (sess.data as { data?: { investor_id?: string }; investor_id?: string } | undefined);
  const investorId = sessData?.data?.investor_id ?? sessData?.investor_id;
  if (!investorId) {
    res.json({ investorId: null, investorType: null });
    return;
  }
  const inv = await getV1InvestorByInvestorId({ path: { investor_id: investorId } });
  const invData = inv.data as { investorType?: string; data?: { investorType?: string } } | undefined;
  const investorType = invData?.investorType ?? invData?.data?.investorType ?? null;
  res.json({ investorId, investorType });
});

// Export a CSV data-modelling mapping document (flattened fields across the
// covered endpoints; spec structure + live examples + drift + settings options).
router.get("/export.csv", async (req, res) => {
  try {
    const csv = await buildEndpointCsv(sessionId(req));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="endpoint-mapping.csv"');
    res.send(csv);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// List advice sessions (DeepAlpha v2). Query params are passed straight through,
// e.g. ?status=open&page=1&size=20
router.get("/advice-sessions", async (req, res) => {
  const { status, page, size } = req.query;
  const { data, error, request, response } = await adviceSession.list({
    query: {
      "filter[status]": status as never,
      "page[number]": page ? Number(page) : undefined,
      "page[size]": size ? Number(size) : undefined,
    },
  });

  relay(res, { data, error, request, response });
});

// Create a goal on the advice session.
// Body: { name, horizon_value, type (goal type, e.g. growYourWealth), icon (url) }.
// `type` and `icon` are both part of the v2 SessionGoalCreateRequestSchemaV2.
router.post("/goals", async (req, res) => {
  const { name, horizon_value, description, type, icon } = req.body ?? {};

  if (typeof name !== "string" || typeof horizon_value !== "number") {
    res
      .status(400)
      .json({ error: "`name` (string) and `horizon_value` (number) are required" });
    return;
  }

  const { data, error, request, response } = await adviceSession.createGoal({
    path: { session_id: sessionId(req) },
    body: {
      name,
      horizon_value,
      description,
      type: typeof type === "string" && type ? type : DEFAULT_GOAL_TYPE,
      icon: typeof icon === "string" && icon ? icon : undefined,
    },
  });

  relay(res, { data, error, request, response }, 201);
});

// List the goals on the session.
router.get("/goals", async (req, res) => {
  const { data, error, request, response } = await adviceSession.listGoals({
    path: { session_id: sessionId(req) },
  });

  relay(res, { data, error, request, response });
});

// Get a single goal (includes its `type`, used to scope goal-information fields).
router.get("/goals/:goalId", async (req, res) => {
  const { data, error, request, response } = await adviceSession.getGoal({
    path: { session_id: sessionId(req), goal_id: req.params.goalId },
  });

  relay(res, { data, error, request, response });
});

// Get a goal's information (advisor notes + config-driven fields).
router.get("/goals/:goalId/information", async (req, res) => {
  const { data, error, request, response } = await adviceSession.getGoalInformation({
    path: { session_id: sessionId(req), goal_id: req.params.goalId },
  });

  relay(res, { data, error, request, response });
});

// Update a goal's information (PATCH).
// Body: { advisor_notes?: string | null, fields?: { [fieldCode]: value } }
router.patch("/goals/:goalId/information", async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.answers !== "object" || body.answers === null || Array.isArray(body.answers)) {
    res.status(400).json({ error: "`answers` must be an object keyed by field code" });
    return;
  }

  const { data, error, request, response } = await adviceSession.updateGoalInformation({
    path: { session_id: sessionId(req), goal_id: req.params.goalId },
    body: {
      advisor_notes: body.advisor_notes ?? null,
      answers: body.answers,
    },
  });

  relay(res, { data, error, request, response });
});

// Full tenant settings (GET /v2/settings/deepalpha).
router.get("/settings", async (_req, res) => {
  try {
    res.json({ settings: await getAllSettings() });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// Get the financial situation for the session.
router.get("/financial-situation", async (req, res) => {
  const { data, error, request, response } = await adviceSession.getFinancialSituation({
    path: { session_id: sessionId(req) },
  });

  relay(res, { data, error, request, response });
});

// Update the financial situation (PATCH). Body follows FinancialSituationUpdateSchemaV2:
//   { advisor_notes?: string | null,
//     person_financial_situation?:  { [category]: Array<{ id, value, ... }> } | null,
//     company_financial_situation?: { [category]: Array<{ id, value, ... }> } | null }
// Categories (assets/debt/liquidity) and item ids come from the tenant's
// roboAdviceForm.financialSituation.{assets,debt,liquidity}.{person,company} config.
router.patch("/financial-situation", async (req, res) => {
  const body = req.body ?? {};
  if (body.person_financial_situation == null && body.company_financial_situation == null) {
    res.status(400).json({
      error: "Provide `person_financial_situation` and/or `company_financial_situation`",
    });
    return;
  }

  const { data, error, request, response } = await adviceSession.updateFinancialSituation({
    path: { session_id: sessionId(req) },
    body: {
      advisor_notes: body.advisor_notes ?? null,
      person_financial_situation: body.person_financial_situation ?? null,
      company_financial_situation: body.company_financial_situation ?? null,
    },
  });

  relay(res, { data, error, request, response });
});

// Get the advice information fields (and current values) for the session.
router.get("/advice-information", async (req, res) => {
  const { data, error, request, response } = await adviceSession.getAdviceInformation({
    path: { session_id: sessionId(req) },
  });

  relay(res, { data, error, request, response });
});

// Update advice information (PATCH). The live API expects the GET-shaped body:
//   { data: { advisor_notes?: string | null, answers: [{ code, value }] } }
// (the spec's { advisor_notes, fields } is stale), so we forward it as-is.
type AdviceInfoBody = NonNullable<Parameters<typeof adviceSession.updateAdviceInformation>[0]>["body"];

router.patch("/advice-information", async (req, res) => {
  const { data, error, request, response } = await adviceSession.updateAdviceInformation({
    path: { session_id: sessionId(req) },
    body: (req.body ?? {}) as unknown as AdviceInfoBody,
  });

  relay(res, { data, error, request, response });
});

// Get the knowledge & experience questions (and current answers) for the session.
router.get("/knowledge-and-experience", async (req, res) => {
  const { data, error, request, response } = await adviceSession.getKnowledgeAndExperience({
    path: { session_id: sessionId(req) },
  });

  relay(res, { data, error, request, response });
});

// Submit knowledge & experience answers.
// Body: { advisor_notes?: string | null, answers: { [questionCode]: optionId } }
router.put("/knowledge-and-experience", async (req, res) => {
  let answers;
  try {
    answers = await parseAnswers(req.body?.answers, sessionId(req));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const { data, error, request, response } = await adviceSession.setKnowledgeAndExperience({
    path: { session_id: sessionId(req) },
    body: {
      advisor_notes: req.body?.advisor_notes ?? null,
      answers,
    },
  });

  relay(res, { data, error, request, response });
});

// Get the risk question values for the session.
router.get("/risk-question", async (req, res) => {
  const { data, error, request, response } = await adviceSession.getRiskQuestion({
    path: { session_id: sessionId(req) },
  });

  relay(res, { data, error, request, response });
});

// Submit risk question answers (PUT).
// Body: { advisor_notes?: string | null, expectation_of_risk?: number | null, risk_strategy?: number | null }
router.put("/risk-question", async (req, res) => {
  const body = req.body ?? {};
  const { data, error, request, response } = await adviceSession.setRiskQuestion({
    path: { session_id: sessionId(req) },
    body: {
      advisor_notes: body.advisor_notes ?? null,
      expectation_of_risk:
        typeof body.expectation_of_risk === "number" ? body.expectation_of_risk : null,
      risk_strategy: typeof body.risk_strategy === "number" ? body.risk_strategy : null,
    },
  });

  relay(res, { data, error, request, response });
});

// Get the sustainability values for the session.
router.get("/sustainability", async (req, res) => {
  const { data, error, request, response } = await adviceSession.getSustainability({
    path: { session_id: sessionId(req) },
  });

  relay(res, { data, error, request, response });
});

// Submit sustainability (PUT). Body: { generic, preference_criteria, alignment_criteria }.
router.put("/sustainability", async (req, res) => {
  const body = req.body ?? {};
  const { data, error, request, response } = await adviceSession.setSustainability({
    path: { session_id: sessionId(req) },
    body: {
      generic: body.generic ?? null,
      preference_criteria: body.preference_criteria ?? null,
      alignment_criteria: body.alignment_criteria ?? null,
    },
  });

  relay(res, { data, error, request, response });
});

// Fetch a single advice session by id.
router.get("/advice-sessions/:sessionId", async (req, res) => {
  const { data, error, request, response } = await adviceSession.get({
    path: { session_id: req.params.sessionId },
  });

  relay(res, { data, error, request, response });
});
