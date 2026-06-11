// Knowledge & Experience answer handling.
//
// The OpenAPI spec types the PUT `answers` field as a free-form object
// (`additionalProperties: {}`). The real keys are the question `code`s, which
// are tenant-specific (e.g. the `argenta.*` codes belong to the Argenta tenant).
// So rather than hardcoding them, we validate submitted answers against the
// questions the GET endpoint actually returns for the session.

import "./api.js";
import { adviceSession } from "./advice-session.js";
import { DEFAULT_SESSION_ID } from "./constants.js";

// answers: { [questionCode]: optionId } for single-select,
//          { [questionCode]: optionId[] } for multi-select.
export type KnowledgeAndExperienceAnswers = Record<string, number | number[]>;

interface Question {
  code: string;
  is_multi_select: boolean;
}

/** Fetch the question set for a session (source of truth for valid codes). */
async function fetchQuestions(sessionId: string): Promise<Question[]> {
  const { data, error } = await adviceSession.getKnowledgeAndExperience({
    path: { session_id: sessionId },
  });
  if (error || !data) {
    throw new Error(`Failed to load knowledge & experience questions: ${JSON.stringify(error)}`);
  }
  // The question set is now self-describing under `meta.questions`.
  return (data.meta?.questions ?? []).map((q) => ({
    code: q.code,
    is_multi_select: q.is_multi_select,
  }));
}

/**
 * Validate an incoming answers map against the session's actual questions.
 * Rejects unknown codes and value types that don't match the question's
 * single/multi-select kind.
 */
export async function parseAnswers(
  input: unknown,
  sessionId: string = DEFAULT_SESSION_ID,
): Promise<KnowledgeAndExperienceAnswers> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("`answers` must be an object keyed by question code");
  }

  const questions = await fetchQuestions(sessionId);
  const byCode = new Map(questions.map((q) => [q.code, q]));

  const result: KnowledgeAndExperienceAnswers = {};
  for (const [code, value] of Object.entries(input)) {
    const question = byCode.get(code);
    if (!question) {
      throw new Error(
        `Unknown question code "${code}". Valid codes: ${questions.map((q) => q.code).join(", ")}`,
      );
    }
    if (question.is_multi_select) {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "number")) {
        throw new Error(`Answer for "${code}" must be an array of option ids (multi-select)`);
      }
    } else if (typeof value !== "number") {
      throw new Error(`Answer for "${code}" must be a number (the selected option id)`);
    }
    result[code] = value as number | number[];
  }
  return result;
}
