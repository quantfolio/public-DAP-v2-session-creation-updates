// Optional default advice session (env: `dap_session_id`). Empty unless set —
// the dev tool sets the active session id on every request, so this is only a
// fallback for direct API calls made without a `?session_id=`.
export const DEFAULT_SESSION_ID = process.env.dap_session_id ?? "";

// The goal type sent in the API's `type` field on goal creation.
export const DEFAULT_GOAL_TYPE = "growYourWealth";
