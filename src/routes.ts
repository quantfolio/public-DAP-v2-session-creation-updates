import { Router } from "express";
import { adviceSession } from "./advice-session.js";
import { DEFAULT_SESSION_ID, DEFAULT_GOAL_TYPE } from "./constants.js";
import { parseAnswers } from "./knowledge-and-experience.js";
import { parseFields } from "./advice-information.js";
import {
  adviceInformationConfig,
  financialSituationConfig,
  goalTypesConfig,
  goalInformationConfig,
  riskQuestionConfig,
  sustainabilityConfig,
} from "./dap-settings.js";
import { login, logout, authStatus } from "./api.js";

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
  if (/\/(health|auth)(\/|$)/.test(req.path) || authStatus().authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated. Log in with client credentials first." });
});

// --- Form config derived from the tenant's live settings (/v2/settings/deepalpha).
// These require auth (they fetch the authenticated tenant's settings).
router.get("/config/goal-types", async (_req, res) => {
  try {
    res.json(await goalTypesConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/goal-information", async (_req, res) => {
  try {
    res.json(await goalInformationConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/sustainability", async (_req, res) => {
  try {
    res.json(await sustainabilityConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/risk-question", async (_req, res) => {
  try {
    res.json(await riskQuestionConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/advice-information", async (_req, res) => {
  try {
    res.json(await adviceInformationConfig());
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get("/config/financial-situation", async (_req, res) => {
  try {
    res.json(await financialSituationConfig());
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

router.get("/health", (_req, res) => {
  res.json({ status: "healthy", uptime: process.uptime() });
});

// List advice sessions (DeepAlpha v2). Query params are passed straight through,
// e.g. ?status=open&page=1&size=20
router.get("/advice-sessions", async (req, res) => {
  const { status, page, size } = req.query;
  const { data, error, response } = await adviceSession.list({
    query: {
      "filter[status]": status as never,
      "page[number]": page ? Number(page) : undefined,
      "page[size]": size ? Number(size) : undefined,
    },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Create a goal on the (currently hardcoded) advice session.
// Body: { name: string, horizon_value: number, description?: string }
// The goal type is sent in the API's `type` field (growYourWealth). `type` is
// accepted by the live API but missing from the OpenAPI spec, hence the cast.
type CreateGoalBody = NonNullable<Parameters<typeof adviceSession.createGoal>[0]>["body"];

router.post("/goals", async (req, res) => {
  const { name, horizon_value, description, type, icon } = req.body ?? {};

  if (typeof name !== "string" || typeof horizon_value !== "number") {
    res
      .status(400)
      .json({ error: "`name` (string) and `horizon_value` (number) are required" });
    return;
  }

  const { data, error, response } = await adviceSession.createGoal({
    path: { session_id: sessionId(req) },
    body: {
      name,
      horizon_value,
      description,
      type: typeof type === "string" && type ? type : DEFAULT_GOAL_TYPE,
      icon: typeof icon === "string" && icon ? icon : undefined,
    } as unknown as CreateGoalBody,
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.status(201).json(data);
});

// Get a goal's information (advisor notes + config-driven fields).
router.get("/goals/:goalId/information", async (req, res) => {
  const { data, error, response } = await adviceSession.getGoalInformation({
    path: { session_id: sessionId(req), goal_id: req.params.goalId },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Update a goal's information (PATCH).
// Body: { advisor_notes?: string | null, fields?: { [fieldCode]: value } }
router.patch("/goals/:goalId/information", async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.fields !== "object" || body.fields === null || Array.isArray(body.fields)) {
    res.status(400).json({ error: "`fields` must be an object keyed by field code" });
    return;
  }

  const { data, error, response } = await adviceSession.updateGoalInformation({
    path: { session_id: sessionId(req), goal_id: req.params.goalId },
    body: {
      advisor_notes: body.advisor_notes ?? null,
      fields: body.fields,
    },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Get the financial situation for the session.
router.get("/financial-situation", async (req, res) => {
  const { data, error, response } = await adviceSession.getFinancialSituation({
    path: { session_id: sessionId(req) },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
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

  const { data, error, response } = await adviceSession.updateFinancialSituation({
    path: { session_id: sessionId(req) },
    body: {
      advisor_notes: body.advisor_notes ?? null,
      person_financial_situation: body.person_financial_situation ?? null,
      company_financial_situation: body.company_financial_situation ?? null,
    },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Get the advice information fields (and current values) for the session.
router.get("/advice-information", async (req, res) => {
  const { data, error, response } = await adviceSession.getAdviceInformation({
    path: { session_id: sessionId(req) },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Update advice information fields (PATCH).
// Body: { advisor_notes?: string | null, fields: { [fieldCode]: value } }
router.patch("/advice-information", async (req, res) => {
  let fields;
  try {
    fields = await parseFields(req.body?.fields, sessionId(req));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const { data, error, response } = await adviceSession.updateAdviceInformation({
    path: { session_id: sessionId(req) },
    body: {
      advisor_notes: req.body?.advisor_notes ?? null,
      fields,
    },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Get the knowledge & experience questions (and current answers) for the session.
router.get("/knowledge-and-experience", async (req, res) => {
  const { data, error, response } = await adviceSession.getKnowledgeAndExperience({
    path: { session_id: sessionId(req) },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
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

  const { data, error, response } = await adviceSession.setKnowledgeAndExperience({
    path: { session_id: sessionId(req) },
    body: {
      advisor_notes: req.body?.advisor_notes ?? null,
      answers,
    },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Get the risk question values for the session.
router.get("/risk-question", async (req, res) => {
  const { data, error, response } = await adviceSession.getRiskQuestion({
    path: { session_id: sessionId(req) },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Submit risk question answers (PUT).
// Body: { advisor_notes?: string | null, expectation_of_risk?: number | null, risk_strategy?: number | null }
router.put("/risk-question", async (req, res) => {
  const body = req.body ?? {};
  const { data, error, response } = await adviceSession.setRiskQuestion({
    path: { session_id: sessionId(req) },
    body: {
      advisor_notes: body.advisor_notes ?? null,
      expectation_of_risk:
        typeof body.expectation_of_risk === "number" ? body.expectation_of_risk : null,
      risk_strategy: typeof body.risk_strategy === "number" ? body.risk_strategy : null,
    },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Get the sustainability values for the session.
router.get("/sustainability", async (req, res) => {
  const { data, error, response } = await adviceSession.getSustainability({
    path: { session_id: sessionId(req) },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Submit sustainability (PUT). Body: { generic, preference_criteria, alignment_criteria }.
router.put("/sustainability", async (req, res) => {
  const body = req.body ?? {};
  const { data, error, response } = await adviceSession.setSustainability({
    path: { session_id: sessionId(req) },
    body: {
      generic: body.generic ?? null,
      preference_criteria: body.preference_criteria ?? null,
      alignment_criteria: body.alignment_criteria ?? null,
    },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});

// Fetch a single advice session by id.
router.get("/advice-sessions/:sessionId", async (req, res) => {
  const { data, error, response } = await adviceSession.get({
    path: { session_id: req.params.sessionId },
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.json(data);
});
