import { Router } from "express";
import { adviceSession } from "./advice-session.js";
import { DEFAULT_SESSION_ID, DEFAULT_GOAL_TYPE } from "./constants.js";
import { parseAnswers } from "./knowledge-and-experience.js";

export const router = Router();

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
  const { name, horizon_value, description } = req.body ?? {};

  if (typeof name !== "string" || typeof horizon_value !== "number") {
    res
      .status(400)
      .json({ error: "`name` (string) and `horizon_value` (number) are required" });
    return;
  }

  const { data, error, response } = await adviceSession.createGoal({
    path: { session_id: DEFAULT_SESSION_ID },
    body: {
      name,
      horizon_value,
      description,
      type: DEFAULT_GOAL_TYPE,
    } as unknown as CreateGoalBody,
  });

  if (error) {
    res.status(response?.status ?? 500).json({ error });
    return;
  }
  res.status(201).json(data);
});

// Get the knowledge & experience questions (and current answers) for the session.
router.get("/knowledge-and-experience", async (_req, res) => {
  const { data, error, response } = await adviceSession.getKnowledgeAndExperience({
    path: { session_id: DEFAULT_SESSION_ID },
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
    answers = await parseAnswers(req.body?.answers);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const { data, error, response } = await adviceSession.setKnowledgeAndExperience({
    path: { session_id: DEFAULT_SESSION_ID },
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
