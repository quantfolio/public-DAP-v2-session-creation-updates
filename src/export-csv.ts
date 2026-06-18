// Builds a CSV "data-modelling mapping" document: one row per flattened leaf
// field across the endpoints the tool covers. Structure comes from openapi.json
// (types/required/enum/description); response rows for GET endpoints are annotated
// with a live example value and a drift flag (spec-only / live-only). The Settings
// endpoint is intentionally excluded.
import { getAccessToken, authStatus } from "./api.js";
import {
  clientInformationConfig,
  financialSituationConfig,
  goalInformationConfig,
  riskQuestionConfig,
  sustainabilityConfig,
  adviceInformationConfig,
  type GoalInformationField,
} from "./dap-settings.js";

const DEFAULT_URI = "https://api.test.deepalpha.dev";

interface Endpoint {
  group: string;
  method: string;
  path: string; // OpenAPI path key
  live?: boolean; // safe to GET for example values
  needs?: ("session_id" | "goal_id" | "investor_id")[];
}

const ENDPOINTS: Endpoint[] = [
  { group: "Setup", method: "GET", path: "/v1/advisor", live: true },
  { group: "Setup", method: "GET", path: "/v1/investor", live: true },
  { group: "Setup", method: "POST", path: "/v1/investor" },
  { group: "Setup", method: "GET", path: "/v1/investor/{investor_id}", live: true, needs: ["investor_id"] },
  { group: "Session", method: "POST", path: "/v2/advice_session" },
  { group: "Session", method: "GET", path: "/v2/advice_session", live: true },
  { group: "Session", method: "GET", path: "/v2/advice_session/{session_id}", live: true, needs: ["session_id"] },
  { group: "Goals", method: "POST", path: "/v2/advice_session/{session_id}/goal" },
  { group: "Goals", method: "GET", path: "/v2/advice_session/{session_id}/goal", live: true, needs: ["session_id"] },
  { group: "Goals", method: "GET", path: "/v2/advice_session/{session_id}/goal/{goal_id}", live: true, needs: ["session_id", "goal_id"] },
  { group: "Goals", method: "GET", path: "/v2/advice_session/{session_id}/goal/{goal_id}/information", live: true, needs: ["session_id", "goal_id"] },
  { group: "Goals", method: "PATCH", path: "/v2/advice_session/{session_id}/goal/{goal_id}/information" },
  { group: "Knowledge & experience", method: "GET", path: "/v2/advice_session/{session_id}/knowledge_and_experience", live: true, needs: ["session_id"] },
  { group: "Knowledge & experience", method: "PUT", path: "/v2/advice_session/{session_id}/knowledge_and_experience" },
  { group: "Risk question", method: "GET", path: "/v2/advice_session/{session_id}/risk_question", live: true, needs: ["session_id"] },
  { group: "Risk question", method: "PUT", path: "/v2/advice_session/{session_id}/risk_question" },
  { group: "Advice information", method: "GET", path: "/v2/advice_session/{session_id}/advice_information", live: true, needs: ["session_id"] },
  { group: "Advice information", method: "PATCH", path: "/v2/advice_session/{session_id}/advice_information" },
  { group: "Sustainability", method: "GET", path: "/v2/advice_session/{session_id}/sustainability", live: true, needs: ["session_id"] },
  { group: "Sustainability", method: "PUT", path: "/v2/advice_session/{session_id}/sustainability" },
  { group: "Financial situation", method: "GET", path: "/v2/advice_session/{session_id}/financial_situation", live: true, needs: ["session_id"] },
  { group: "Financial situation", method: "PATCH", path: "/v2/advice_session/{session_id}/financial_situation" },
  { group: "Categories", method: "GET", path: "/v2/categories", live: true },
];

type Spec = Record<string, any>;
interface FieldRow {
  path: string;
  type: string;
  required: boolean;
  enum: string;
  format: string;
  description: string;
}

let specCache: Spec | null = null;
async function loadSpec(): Promise<Spec> {
  if (!specCache) {
    const baseUrl = authStatus().uri ?? DEFAULT_URI;
    specCache = (await fetch(`${baseUrl}/openapi.json`).then((r) => r.json())) as Spec;
  }
  return specCache;
}

function resolveRef(spec: Spec, ref: string): any {
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce<any>((cur, p) => cur?.[p], spec);
}

function deref(spec: Spec, schema: any): any {
  let s = schema;
  const guard = new Set<string>();
  while (s && s.$ref) {
    if (guard.has(s.$ref)) return {};
    guard.add(s.$ref);
    s = resolveRef(spec, s.$ref);
  }
  return s ?? {};
}

function typeOf(s: any): string {
  if (s.enum) return Array.isArray(s.type) ? s.type.join("|") : (s.type ?? "enum");
  if (s.type) return Array.isArray(s.type) ? s.type.join("|") : s.type;
  if (s.properties || s.additionalProperties) return "object";
  if (s.items) return "array";
  if (s.anyOf || s.oneOf || s.allOf) return "object";
  return "any";
}

// Flatten a JSON Schema into leaf field rows (dot paths, [] for arrays, .{key} for maps).
function flattenSchema(
  spec: Spec,
  rawSchema: any,
  prefix: string,
  required: boolean,
  depth: number,
  seen: Set<string>,
): FieldRow[] {
  if (depth > 8) return [{ path: prefix || "(root)", type: "…", required, enum: "", format: "", description: "max depth" }];
  const refKey = rawSchema?.$ref as string | undefined;
  if (refKey) {
    if (seen.has(refKey)) return [{ path: prefix, type: "(recursive)", required, enum: "", format: "", description: refKey.split("/").pop() ?? "" }];
    seen = new Set(seen).add(refKey);
  }
  const s = deref(spec, rawSchema);

  // allOf → merge all subschemas
  if (Array.isArray(s.allOf)) {
    return s.allOf.flatMap((sub: any) => flattenSchema(spec, sub, prefix, required, depth, seen));
  }
  // anyOf/oneOf → expand the first object/array branch, else a single leaf
  const union = s.anyOf ?? s.oneOf;
  if (Array.isArray(union)) {
    const branch = union.map((u: any) => deref(spec, u)).find((u: any) => u.properties || u.items || u.additionalProperties);
    if (branch) return flattenSchema(spec, branch, prefix, required, depth, seen);
    const types = union.map((u: any) => typeOf(deref(spec, u))).join("|");
    return [{ path: prefix, type: types, required, enum: "", format: "", description: s.description ?? "" }];
  }

  // object with properties
  if (s.properties && typeof s.properties === "object") {
    const req: string[] = Array.isArray(s.required) ? s.required : [];
    const rows: FieldRow[] = [];
    for (const [key, child] of Object.entries<any>(s.properties)) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      rows.push(...flattenSchema(spec, child, childPath, req.includes(key), depth + 1, seen));
    }
    // free-form extra keys alongside declared properties
    if (s.additionalProperties && typeof s.additionalProperties === "object") {
      rows.push(...flattenSchema(spec, s.additionalProperties, `${prefix}.{key}`, false, depth + 1, seen));
    }
    return rows;
  }
  // free-form map
  if (s.additionalProperties) {
    const ap = typeof s.additionalProperties === "object" ? s.additionalProperties : {};
    return flattenSchema(spec, ap, `${prefix}.{key}`, false, depth + 1, seen);
  }
  // array
  if (s.items) {
    return flattenSchema(spec, s.items, `${prefix}[]`, required, depth + 1, seen);
  }
  // scalar leaf
  return [
    {
      path: prefix || "(root)",
      type: typeOf(s),
      required,
      enum: Array.isArray(s.enum) ? s.enum.map(String).join(" | ") : "",
      format: s.format ?? (s.maxLength ? `maxLength ${s.maxLength}` : ""),
      description: typeof s.description === "string" ? s.description : "",
    },
  ];
}

// Flatten a live JSON value into path → example string.
function flattenJson(value: unknown, prefix: string, out: Map<string, string>): void {
  if (Array.isArray(value)) {
    if (value.length) flattenJson(value[0], `${prefix}[]`, out);
    else out.set(`${prefix}[]`, "[]");
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flattenJson(v, prefix ? `${prefix}.${k}` : k, out);
    return;
  }
  const str = value === null ? "null" : String(value);
  out.set(prefix, str.length > 80 ? `${str.slice(0, 77)}…` : str);
}

function bodySchema(spec: Spec, path: string, method: string): any {
  return spec.paths?.[path]?.[method.toLowerCase()]?.requestBody?.content?.["application/json"]?.schema;
}
function responseSchema(spec: Spec, path: string, method: string): any {
  const responses = spec.paths?.[path]?.[method.toLowerCase()]?.responses ?? {};
  const code = ["200", "201", "202"].find((c) => responses[c]) ?? Object.keys(responses).find((c) => c.startsWith("2"));
  return code ? responses[code]?.content?.["application/json"]?.schema : undefined;
}

const COLUMNS = [
  "group",
  "endpoint",
  "method",
  "direction",
  "subject",
  "field",
  "type",
  "required",
  "options",
  "enum",
  "format",
  "example",
  "drift",
  "description",
] as const;
type Row = Partial<Record<(typeof COLUMNS)[number], string>>;

const csvEscape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const serialize = (rows: Row[]) =>
  [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvEscape(String(r[c] ?? ""))).join(","))].join("\n");

const opt = (o: { value: string; label: string }[]) => o.map((x) => x.value).join(" | ");

// Settings-driven fields per endpoint, emitted for both input (request) and
// output (response), and split by person/company where the setting differs.
async function settingsRows(): Promise<Row[]> {
  const rows: Row[] = [];
  const emit = (
    targets: { group: string; endpoint: string; method: string; direction: string }[],
    field: Omit<Row, "group" | "endpoint" | "method" | "direction">,
  ) => {
    for (const t of targets) rows.push({ ...t, ...field });
  };

  // Investor — clientInformation (person + company)
  const ci = await clientInformationConfig();
  const investorIO = [
    { group: "Setup", endpoint: "/v1/investor", method: "POST", direction: "request" },
    { group: "Setup", endpoint: "/v1/investor/{investor_id}", method: "GET", direction: "response" },
  ];
  for (const subject of ["person", "company"] as const) {
    for (const f of ci[subject]) {
      emit(investorIO, {
        subject,
        field: f.code,
        type: f.componentType,
        required: f.required ? "yes" : "no",
        options: opt(f.options),
        description: `settings → roboAdvice.clientInformation.${subject}`,
      });
    }
  }

  // Financial situation (person + company)
  const fs = await financialSituationConfig();
  const fsEndpoint = "/v2/advice_session/{session_id}/financial_situation";
  const fsIO = [
    { group: "Financial situation", endpoint: fsEndpoint, method: "PATCH", direction: "request" },
    { group: "Financial situation", endpoint: fsEndpoint, method: "GET", direction: "response" },
  ];
  for (const subject of ["person", "company"] as const) {
    for (const cat of ["assets", "debt", "liquidity"] as const) {
      for (const f of fs[subject][cat]) {
        const options = f.kind === "boolean" ? "true | false" : f.hasAssetClass ? "assetClass: CategoryId (see /v2/categories)" : "";
        emit(fsIO, {
          subject,
          field: `${subject}_financial_situation.${f.id}${f.kind === "array" ? "[]" : ""}`,
          type: f.kind,
          options,
          description: `${cat} · settings → roboAdviceForm.financialSituation.${cat}.${subject}`,
        });
      }
    }
  }

  // Goal information (flatten conditional sub-fields; not subject-specific)
  const giEndpoint = "/v2/advice_session/{session_id}/goal/{goal_id}/information";
  const giIO = [
    { group: "Goals", endpoint: giEndpoint, method: "PATCH", direction: "request" },
    { group: "Goals", endpoint: giEndpoint, method: "GET", direction: "response" },
  ];
  const walkGi = (fields: GoalInformationField[]) => {
    for (const f of fields) {
      emit(giIO, {
        field: `fields.${f.code}`,
        type: f.componentType,
        options: opt(f.options),
        description: `goalTypes: ${f.goalTypes.join(" | ") || "(all)"}`,
      });
      for (const o of f.options) if (o.conditionalFields.length) walkGi(o.conditionalFields);
    }
  };
  walkGi(await goalInformationConfig());

  // Risk question
  const rq = await riskQuestionConfig();
  const rqEndpoint = "/v2/advice_session/{session_id}/risk_question";
  const rqIO = [
    { group: "Risk question", endpoint: rqEndpoint, method: "PUT", direction: "request" },
    { group: "Risk question", endpoint: rqEndpoint, method: "GET", direction: "response" },
  ];
  emit(rqIO, { field: "expectation_of_risk", type: "integer (id)", options: rq.expectationOfRisk.options.map((o) => o.id).join(" | ") });
  if (rq.riskStrategy.enabled)
    emit(rqIO, { field: "risk_strategy", type: "integer (id)", options: rq.riskStrategy.options.map((o) => o.id).join(" | "), description: "enabled (isRisk2Hidden=false)" });

  // Sustainability
  const su = await sustainabilityConfig();
  const suEndpoint = "/v2/advice_session/{session_id}/sustainability";
  const suIO = [
    { group: "Sustainability", endpoint: suEndpoint, method: "PUT", direction: "request" },
    { group: "Sustainability", endpoint: suEndpoint, method: "GET", direction: "response" },
  ];
  emit(suIO, { field: "preference_criteria.themes[]", type: "string (id)", options: su.exclusionCriteria.map((c) => c.id).join(" | "), description: "exclusion criteria" });
  emit(suIO, { field: "alignment_criteria.{key}.value", type: "integer (step)", options: su.steps.map((s) => s.value).join(" | "), description: `keys: ${su.alignmentCriteria.map((a) => a.key).join(" | ")}` });

  // Advice information
  const ai = await adviceInformationConfig();
  const aiEndpoint = "/v2/advice_session/{session_id}/advice_information";
  const aiIO = [
    { group: "Advice information", endpoint: aiEndpoint, method: "PATCH", direction: "request" },
    { group: "Advice information", endpoint: aiEndpoint, method: "GET", direction: "response" },
  ];
  for (const f of ai) {
    emit(aiIO, { field: `data.answers[].${f.code}`, type: f.componentType, options: opt(f.options) });
  }

  return rows;
}

export async function buildEndpointCsv(sessionId: string): Promise<string> {
  const spec = await loadSpec();
  const baseUrl = authStatus().uri ?? DEFAULT_URI;

  // Resolve ids for live samples (best-effort, read-only).
  const token = await getAccessToken();
  const get = (p: string) =>
    fetch(`${baseUrl}${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

  const ids: Record<string, string | undefined> = { session_id: sessionId };
  const sess = await get(`/v2/advice_session/${sessionId}`);
  ids.investor_id = sess?.data?.investor_id;
  const goals = await get(`/v2/advice_session/${sessionId}/goal`);
  ids.goal_id = goals?.data?.[0]?.id;

  const rows: Row[] = [];

  for (const ep of ENDPOINTS) {
    // Request rows (spec).
    const reqSchema = bodySchema(spec, ep.path, ep.method);
    if (reqSchema) {
      for (const f of flattenSchema(spec, reqSchema, "", false, 0, new Set())) {
        rows.push({
          group: ep.group,
          endpoint: ep.path,
          method: ep.method,
          direction: "request",
          field: f.path,
          type: f.type,
          required: f.required ? "yes" : "no",
          enum: f.enum,
          format: f.format,
          description: f.description,
        });
      }
    }

    // Response rows (spec) + live example/drift for sampled GETs.
    const resSchema = responseSchema(spec, ep.path, ep.method);
    const live = new Map<string, string>();
    let sampled = false;
    if (ep.live && ep.method === "GET" && !(ep.needs ?? []).some((n) => !ids[n])) {
      let p = ep.path;
      for (const [k, v] of Object.entries(ids)) if (v) p = p.replace(`{${k}}`, v);
      const body = await get(p);
      if (body != null) {
        flattenJson(body, "", live);
        sampled = true;
      }
    }

    const specPaths = new Set<string>();
    if (resSchema) {
      for (const f of flattenSchema(spec, resSchema, "", false, 0, new Set())) {
        specPaths.add(f.path);
        rows.push({
          group: ep.group,
          endpoint: ep.path,
          method: ep.method,
          direction: "response",
          field: f.path,
          type: f.type,
          required: f.required ? "yes" : "no",
          enum: f.enum,
          format: f.format,
          example: live.get(f.path) ?? "",
          drift: sampled && !live.has(f.path) ? "spec-only" : "",
          description: f.description,
        });
      }
    }
    if (sampled) {
      for (const [path, example] of live) {
        if (specPaths.has(path)) continue;
        rows.push({ group: ep.group, endpoint: ep.path, method: ep.method, direction: "response", field: path, example, drift: "live-only" });
      }
    }
  }

  rows.push(...(await settingsRows()));
  return serialize(rows);
}
