// Self-contained TypeScript examples per section: authenticate, fetch tenant
// settings, derive the options, MAP the advisor's selections into the payload,
// and send the request. The mapping is the part worth copying.
const BASE = "https://api.test.deepalpha.dev";

const PREAMBLE = `// 1. Authenticate (OAuth2 client credentials) + load tenant settings
const { access_token } = await fetch("${BASE}/v1/auth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", client_id, client_secret }),
}).then((r) => r.json());
const auth = { Authorization: \`Bearer \${access_token}\`, "Content-Type": "application/json" };

const settings: { name: string; value: any }[] = await fetch("${BASE}/v2/settings/deepalpha", {
  headers: auth,
}).then((r) => r.json()).then((r) => r.settings);
const setting = (name: string) => settings.find((s) => s.name === name)?.value;`;

const send = (method: string, path: string, withBody = true) =>
  `await fetch(\`${BASE}${path}\`, {
  method: "${method}",
  headers: auth,${withBody ? "\n  body: JSON.stringify(body)," : ""}
}).then((r) => r.json());`;

const join = (...parts: string[]) => parts.join("\n\n");

export function createInvestorCode(): string {
  return join(
    PREAMBLE,
    `// 2. Pick an advisor (advisorId links the investor to an advisor)
const advisors = await fetch("${BASE}/v1/advisor", { headers: auth })
  .then((r) => r.json()).then((r) => r.advisors); // [{ advisor_id, name, email }]`,
    `// 3. Create the investor — country + investorType are required
const body = {
  name: "Jane Doe",
  investorType: "person", // "person" | "company"
  country: "BE",          // ISO 3166-1 alpha-2
  advisorId: advisors[0].advisor_id,
};`,
    "// 4. POST → returns { id, ... }\n" + send("POST", "/v1/investor"),
  );
}

export function createSessionCode(): string {
  return join(
    PREAMBLE,
    `// 2. You need an advisor_id (GET /v1/advisor) and usually an investor_id
//    (POST /v1/investor or GET /v1/investor).`,
    `// 3. Create the advice session — advisor_id + name are required
const body = {
  advisor_id,
  name: "New advice session",
  investor_id,
  advice_type: "MiFIID II investment Advice", // | "Order Execution"
};`,
    "// 4. POST → returns { session_id, ... } — use that id for all v2 sub-resources\n" +
      send("POST", "/v1/state_session"),
  );
}

export function createGoalCode(): string {
  return join(
    PREAMBLE,
    `// 2. Goal types + icons + allowed horizons (from settings)
const goalTypes = Array.from({ length: 8 }, (_, i) => i + 1)
  .map((n) => ({
    type: setting(\`roboAdviceForm.purposeAndRisk.goals.goal\${n}.type\`) as string | null,
    label: setting(\`roboAdviceForm.purposeAndRisk.goals.goal\${n}.translations\`)?.en,
    iconUrl: setting(\`roboAdviceForm.purposeAndRisk.goals.goal\${n}.iconUrl\`) as string,
  }))
  .filter((g) => g.type);
const horizons = (setting("timeHorizonConfig.items") ?? [])
  .map((h: any) => ({ value: h.riskHorizonValue, label: h.label?.en })); // value is 1..4`,
    `// 3. Build the payload from the advisor's choices (icon is inferred from the type)
const chosen = goalTypes.find((g) => g.type === "growYourWealth")!;
const body = {
  name: "New goal",
  horizon_value: horizons[0].value, // one of the allowed ids, NOT a number of years
  type: chosen.type,
  icon: chosen.iconUrl,
};`,
    "// 4. Create the goal\n" + send("POST", "/v2/advice_session/${sessionId}/goal"),
  );
}

export function goalInformationCode(): string {
  return join(
    PREAMBLE,
    `// 2. The goal's type scopes which fields apply
const goalType = await fetch(\`${BASE}/v2/advice_session/\${sessionId}/goal/\${goalId}\`, {
  headers: auth,
}).then((r) => r.json()).then((r) => r.data.type);

const fields = (setting("roboAdviceForm.goalInformation.fields") ?? [])
  .filter((f: any) => f.isEnabled !== false && f.goalTypes.includes(goalType));`,
    `// 3. Map selections → fields. Keys are the FULL setting name (incl.
//    "goalInformation." prefix). Options may carry \`conditionalFields\` that
//    apply only when selected — include those too (recurse).
const selections: Record<string, string> = {
  "goalInformation.lifeInsuranceNeed": "receivedDonation",
  "goalInformation.donorControl": "no",          // revealed by the choice above
  "goalInformation.investmentRules": "noChange",
};
const body = { advisor_notes: null, fields: selections };`,
    "// 4. Save\n" + send("PATCH", "/v2/advice_session/${sessionId}/goal/${goalId}/information"),
  );
}

export function knowledgeExperienceCode(): string {
  return join(
    PREAMBLE,
    `// 2. Questions are self-describing on the GET under meta.questions
const ke = await fetch(
  \`${BASE}/v2/advice_session/\${sessionId}/knowledge_and_experience\`,
  { headers: auth },
).then((r) => r.json());
const questions = ke.meta.questions; // each: { code, label, is_multi_select, options: [{ id, label }] }
// current answers (keyed by question code) live in ke.data.answers`,
    `// 3. Map question code → selected option id
const answers: Record<string, number> = {};
for (const q of questions) {
  // pick the option your UI selected; here we take the first as an example
  if (q.options[0]) answers[q.code] = q.options[0].id;
}
const body = { advisor_notes: null, answers };`,
    "// 4. Submit\n" + send("PUT", "/v2/advice_session/${sessionId}/knowledge_and_experience"),
  );
}

export function riskQuestionCode(): string {
  return join(
    PREAMBLE,
    `// 2. Options; risk strategy (risk 2) is optional — gate before using it
const expectationOfRisk = (setting("roboAdviceForm.purposeAndRisk.expectationOfRisk") ?? [])
  .map((o: any) => ({ id: o.id, label: o.translations?.en_gb ?? o.title }));
const riskStrategyEnabled = !setting("roboAdviceForm.riskQuestions.isRisk2Hidden");
const riskStrategy = riskStrategyEnabled
  ? (setting("roboAdviceForm.purposeAndRisk.riskStrategy") ?? []).map((o: any) => ({ id: o.id, label: o.title }))
  : [];`,
    `// 3. Build the payload (ids, or null when unanswered / disabled)
const body = {
  advisor_notes: null,
  expectation_of_risk: expectationOfRisk[0]?.id ?? null,
  risk_strategy: riskStrategyEnabled ? (riskStrategy[0]?.id ?? null) : null,
};`,
    "// 4. Submit\n" + send("PUT", "/v2/advice_session/${sessionId}/risk_question"),
  );
}

export function adviceInformationCode(): string {
  return join(
    PREAMBLE,
    `// 2. Fields are self-describing on the GET (meta.fields)
const info = await fetch(
  \`${BASE}/v2/advice_session/\${sessionId}/advice_information\`,
  { headers: auth },
).then((r) => r.json());
const fields = info.meta.fields; // { code, label, type, options, depends_on, required }`,
    `// 3. Map code → value (a field with \`depends_on\` only applies when its
//    dependency matches). NOTE: the PATCH body is wrapped in { data: { answers } }.
const values: Record<string, string> = { riskProfileChanged: "yes", riskProfileChangeReason: "…" };
const answers = fields
  .filter((f: any) => !f.depends_on || values[f.depends_on.code] === f.depends_on.value)
  .filter((f: any) => values[f.code] != null)
  .map((f: any) => ({ code: f.code, value: values[f.code] }));
const body = { data: { advisor_notes: null, answers } };`,
    "// 4. Save\n" + send("PATCH", "/v2/advice_session/${sessionId}/advice_information"),
  );
}

export function sustainabilityCode(): string {
  return join(
    PREAMBLE,
    `// 2. Exclusion criteria, alignment criteria (enabled only) + steps
const exclusionCriteria = (setting("roboAdvice.sustainability.sustainabilityPreference.config") ?? [])
  .map((o: any) => ({ id: o.id, label: o.title?.en }));
const steps = (setting("roboAdvice.sustainability.alignmentCriteria.stepsScheme") ?? [])
  .map((s: any) => ({ value: s.value, label: s.label?.en }));
const alignmentCriteria = Array.from({ length: 5 }, (_, i) => i + 1)
  .filter((n) => setting(\`roboAdvice.sustainability.alignmentCriteria\${n}.enabled\`))
  .map((n) => \`alignmentCriteria\${n}\`);`,
    `// 3. Build the payload
const body = {
  generic: { answer: true, comment: null },
  preference_criteria: { advisor_notes: null, themes: [exclusionCriteria[0]?.id] }, // ids
  alignment_criteria: Object.fromEntries(
    alignmentCriteria.map((key) => [key, { advisor_notes: null, value: steps[0].value }]),
  ),
};`,
    "// 4. Submit\n" + send("PUT", "/v2/advice_session/${sessionId}/sustainability"),
  );
}

export function financialSituationCode(): string {
  return join(
    PREAMBLE,
    `// 2. Fields per category (from settings) + asset classes (from /v2/categories).
//    Only assets/debt have an asset class; liquidity fields carry their own type.
const fieldsFor = (cat: "assets" | "debt" | "liquidity") =>
  (setting(\`roboAdviceForm.financialSituation.\${cat}.person\`) ?? [])
    .filter((i: any) => i.enabled !== false && i.id)
    .map((i: any) => ({ id: i.id, label: i.label?.en, type: i.type ?? "numberInput" }));
const assetClasses = await fetch("${BASE}/v2/categories", { headers: auth })
  .then((r) => r.json())
  .then((r) => r.data.map((c: any) => ({ id: c.CategoryId, label: c.SubAssetClass }))); // asset_class = CategoryId`,
    `// 3. Map rows → records, keyed by FIELD id. Each record has its own uuid;
//    keep a trailing { id } placeholder so an empty row is always available.
const rows = { externalFinancialAssets: [{ value: 50000, title: "Brokerage", assetClass: "C20" }] };
const person_financial_situation = Object.fromEntries(
  Object.entries(rows).map(([fieldId, items]) => [
    fieldId,
    [
      ...items.map((r) => ({ id: crypto.randomUUID(), value: r.value, title: r.title ?? null, assetClass: r.assetClass ?? null })),
      { id: crypto.randomUUID() }, // empty placeholder row
    ],
  ]),
);
const body = { advisor_notes: null, person_financial_situation };`,
    "// 4. Save\n" + send("PATCH", "/v2/advice_session/${sessionId}/financial_situation"),
  );
}
