// Advice information `fields` validation.
//
// The spec types the PATCH `fields` as a free-form object (`additionalProperties`).
// The real keys are config-driven field codes (e.g. `riskProfileChanged`), so we
// validate submitted fields against the codes the GET endpoint returns for the
// session rather than hardcoding them.
import "./api.js";
import { adviceSession } from "./advice-session.js";
import { DEFAULT_SESSION_ID } from "./constants.js";

export type AdviceInformationFields = Record<string, unknown>;

/** Validate a `fields` map against the session's actual advice-information field codes. */
export async function parseFields(
  input: unknown,
  sessionId: string = DEFAULT_SESSION_ID,
): Promise<AdviceInformationFields> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("`fields` must be an object keyed by field code");
  }

  const { data, error } = await adviceSession.getAdviceInformation({
    path: { session_id: sessionId },
  });
  if (error || !data) {
    throw new Error(`Failed to load advice information fields: ${JSON.stringify(error)}`);
  }
  const codes = (data.data ?? []).map((f) => f.code);
  const valid = new Set(codes);

  const result: AdviceInformationFields = {};
  for (const [code, value] of Object.entries(input)) {
    if (!valid.has(code)) {
      throw new Error(`Unknown field code "${code}". Valid codes: ${codes.join(", ")}`);
    }
    result[code] = value;
  }
  return result;
}
