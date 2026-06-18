# DeepAlpha API — Integration Dev Tool

A small full‑stack reference app for building integrations against the **DeepAlpha v2 `advice_session` API**. It shows, for each endpoint, the exact request/response, how the payloads are built, and which **tenant settings** drive the available options — so you can copy the patterns into your own integration.

- **API layer** (`src/`): a thin Express server that holds your OAuth2 client credentials, exchanges them for a bearer token, and proxies to DeepAlpha using a generated, typed client (`@hey-api/openapi-ts`).
- **Dev tool** (`web/`): a Vite + React + Tailwind + shadcn/ui console. Each section is a real, settings‑driven form with a live **Payload** preview and a copy‑pasteable **TypeScript** example.

> The base URL used throughout is the test environment: `https://api.test.deepalpha.dev`.

---

## Running it

Two processes (the Vite dev server proxies `/api` → the Express server on `:3000`):

```bash
pnpm install          # API deps
pnpm web:install      # dev-tool deps (web/)

pnpm dev              # API on http://localhost:3000   (terminal 1)
pnpm web              # dev tool on http://localhost:5173 (terminal 2)
```

Open **http://localhost:5173** and authenticate in the **Authentication** card.

Credentials may be supplied two ways:
- the **Authentication** card in the UI (preferred), or
- a `.env` file (gitignored) as a default: `dap_uri`, `dap_client_id`, `dap_client_secret` (see `.env.example`).

Regenerate the typed client after a spec change: `pnpm gen` (fetches the spec from `https://api.test.deepalpha.dev/openapi.json`).

---

## How integration works

### 1. Authenticate (OAuth2 client credentials)

```ts
const { access_token } = await fetch("https://api.test.deepalpha.dev/v1/auth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", client_id, client_secret }),
}).then((r) => r.json());

const auth = { Authorization: `Bearer ${access_token}` };
```

Send `Authorization: Bearer <token>` on every subsequent request. There is no v2 auth endpoint — `/v1/auth/token` is correct.

> **Keep the `client_secret` server‑side.** This tool models that: the secret lives in the Express layer, the browser only ever talks to the proxy and never sees the token. Never ship `client_secret` (or the bearer token) to a browser/mobile client. Cache the token and **refresh on a `401` and retry once** — tokens expire and can be revoked (the API layer here does exactly this).

### 2. Load the tenant settings

Most forms are **configuration‑driven**. Fetch the tenant's settings once and look options up by `name`:

```ts
const settings: { name: string; value: any }[] = await fetch(
  "https://api.test.deepalpha.dev/v2/settings/deepalpha",
  { headers: auth },
).then((r) => r.json()).then((r) => r.settings);

const setting = (name: string) => settings.find((s) => s.name === name)?.value;
```

`deepalpha` is the application id.

### 3. Create or pick a session

Everything below operates on an advice session (`/v2/advice_session`). A real integration **starts by creating an investor and a session** (the **Setup** section in the tool):

```ts
// create an investor (country + investorType required)
const investor = await fetch(`${BASE}/v1/investor`, {
  method: "POST", headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Jane Doe", investorType: "person", country: "BE", advisorId }),
}).then((r) => r.json()); // → { id, ... }

// create an advice session (v2; advisor_id + investor_id + name required)
const session = await fetch(`${BASE}/v2/advice_session`, {
  method: "POST", headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    advisor_id, investor_id: investor.id, name: "New advice session",
    advice_type: "mifid", // "mifid" | "order_execution"
  }),
}).then((r) => r.json()); // → { data: { session_id, ... } }
```

`advisor_id` comes from `GET /v1/advisor`. Then pass `session.data.session_id` on each v2 sub‑resource call.

## Scope & coverage

This tool covers the **advice‑session journey**: create investor/session, then goals, goal information, knowledge & experience, risk question, advice information, sustainability, and financial situation — plus the settings and categories that drive them.

It does **not** cover the rest of the DeepAlpha API (analyze, robo, proposal/order, webhooks, products, timeseries, documents). Those follow the same auth + settings patterns shown here.

### Field mapping export (CSV)

The **Export CSV** button (header) downloads a data‑modelling mapping document — one row per flattened leaf field across the covered endpoints, for both **input** (request) and **output** (response). Columns: `group, endpoint, method, direction, subject, field, type, required, options, enum, format, example, drift, description`.

- Structure comes from the live OpenAPI spec; response fields of GET endpoints are annotated with a **live example** and a **drift** flag (`spec-only` / `live-only`) so you can see where the live API diverges.
- Settings‑driven fields are overlaid with their available **options**, split by **subject** (`person` / `company`) where the settings differ (investor/clientInformation, financial situation).
- Served by `GET /api/export.csv` (or per session: `?session_id=…`). The Settings endpoint is excluded.

---

## Endpoints & payload shapes

All advice‑session sub‑resources are under `/v2/advice_session/{session_id}/…`.

| Sub‑resource | Methods | Options source |
|---|---|---|
| `goal` | GET (list/one), POST | goal types from settings |
| `goal/{goal_id}/information` | GET, PATCH | `roboAdviceForm.goalInformation.fields` (+ conditional) |
| `knowledge_and_experience` | GET, PUT | the GET response (`data.questions[].options`) |
| `risk_question` | GET, PUT | `roboAdviceForm.purposeAndRisk.{expectationOfRisk,riskStrategy}` |
| `advice_information` | GET, PATCH | the GET response (`meta.fields`) |
| `sustainability` | GET, PUT | settings (exclusion criteria, alignment criteria) |
| `financial_situation` | GET, PATCH | settings (fields) + `/v2/categories` (asset classes) |

### Goals

`POST /v2/advice_session/{session_id}/goal` with `{ name, horizon_value, type, icon }`.

- **`type`** is the goal type (e.g. `growYourWealth`) from `roboAdviceForm.purposeAndRisk.goals.goal{N}.type`. *(Note: `type` is accepted by the API but not in the OpenAPI spec.)*
- **`icon`** is the icon URL from the same goal config (`…goal{N}.iconUrl`) — selecting a type infers the icon.
- **`horizon_value`** must be one of the allowed ids from `timeHorizonConfig.items` (`riskHorizonValue`, 1–4), not an arbitrary number of years.
- A goal's **`type`** is returned by `GET …/goal/{goal_id}` and the goals list (use it to scope goal‑information fields).

### Goal information

`GET·PATCH /v2/advice_session/{session_id}/goal/{goal_id}/information`, body `{ advisor_notes, fields }`.

- Fields come from `roboAdviceForm.goalInformation.fields`, **scoped to the goal's `type`**.
- Field keys are the **full setting name including the `goalInformation.` prefix** (e.g. `goalInformation.lifeInsuranceNeed`) — do not strip it.
- Options can carry **`conditionalFields`**: selecting an option reveals more fields (recursively). e.g. `lifeInsuranceNeed = "receivedDonation"` reveals `donorControl` and `additionalCoverReceivedDonation`. Only submit fields that are currently applicable.

### Knowledge & experience

`GET·PUT /v2/advice_session/{session_id}/knowledge_and_experience`, body `{ advisor_notes, answers }`.

- The **GET response is self‑describing**: `data.questions[]` gives `{ code, label, is_multi_select, options: [{ id, label }], value }`.
- `answers` is keyed by question `code` → selected option `id`.

### Risk question

`GET·PUT /v2/advice_session/{session_id}/risk_question`, body `{ advisor_notes, expectation_of_risk, risk_strategy }` (integer ids or null).

- Options from `roboAdviceForm.purposeAndRisk.expectationOfRisk` / `…riskStrategy`.
- **Risk strategy is optional** — gate it on `!setting("roboAdviceForm.riskQuestions.isRisk2Hidden")` before fetching/sending it.

### Advice information

`GET·PATCH /v2/advice_session/{session_id}/advice_information`.

- The **GET response is self‑describing**: `meta.fields[]` gives `{ code, label, type, options, depends_on, required }`; `data.answers[]` holds current values.
- A field with `depends_on` only applies when `values[depends_on.code] === depends_on.value`.
- **PATCH body** (note: differs from the spec): `{ data: { advisor_notes, answers: [{ code, value }] } }`.

### Sustainability

`GET·PUT /v2/advice_session/{session_id}/sustainability`, body `{ generic, preference_criteria, alignment_criteria }`.

- `generic`: `{ answer: boolean | null, comment }`.
- `preference_criteria`: `{ advisor_notes, themes: string[] }` — **exclusion criteria** ids from `roboAdvice.sustainability.sustainabilityPreference.config` (e.g. `preferenceCriteria1`).
- `alignment_criteria`: `{ [key]: { advisor_notes, value } }` keyed `alignmentCriteria{N}` (enabled ones only); `value` is a step `0..` from `roboAdvice.sustainability.alignmentCriteria.stepsScheme`.

### Financial situation

`GET·PATCH /v2/advice_session/{session_id}/financial_situation`, body `{ advisor_notes, person_financial_situation, company_financial_situation }`.

- `person_financial_situation` is **keyed by field id** (e.g. `externalFinancialAssets`), each an **array of records**. Categories (`assets` / `debt` / `liquidity`) and their fields come from `roboAdviceForm.financialSituation.{cat}.person`.
- Each record: `{ id, value, title?, assetClass? }`.
  - **`id` is a per‑record UUID** (generate `crypto.randomUUID()` for new rows; keep existing ones). Always keep a trailing empty placeholder row (`{ id }` only) so an empty entry is available.
  - **`assetClass`** (camelCase) stores a **`CategoryId`** from `GET /v2/categories` (e.g. `C20`); the label is its `SubAssetClass`. Only **assets**/**debt** have an asset class — **liquidity does not**.
  - Field **input type** comes from the field's `type` (`numberInput` → number, `textInput`/`textarea` → text, `buttonSwitch` → toggle); not every field is an amount.
- `/v2/categories` isn't marked secured in the spec but requires a bearer token.

---

## Notes on spec drift

The live API diverges from `openapi.json` in a few places the tool works around: the `advice_information` GET/PATCH shapes, `financial_situation` field‑keyed records, and `/v2/categories` auth. Treat the live responses (and this tool) as the source of truth, and regenerate the client when the spec catches up.

---

## Project layout

```
src/                     Express API (proxy + typed DeepAlpha client)
  api.ts                 auth (client credentials), runtime login
  routes.ts              /api/* routes (one per sub-resource + /config/*)
  dap-settings.ts        derives form config from /v2/settings/deepalpha & /v2/categories
  client/                generated client (pnpm gen)
web/                     Vite + React + shadcn dev tool
  src/sections/          one component per endpoint
  src/lib/codegen.ts     the TypeScript examples shown in the UI
```
