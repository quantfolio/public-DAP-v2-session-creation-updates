// Extracts form/field configuration from the tenant settings so the dev-tool UI
// can render intuitive inputs instead of raw JSON.
//
// Settings are fetched live from GET /v2/settings/deepalpha (for the authenticated
// tenant) and cached in-memory. Call clearSettingsCache() on login/logout so a
// different tenant's settings are re-fetched.
import { getV2SettingsByApplication, getV2Categories } from "./client/sdk.gen.js";
import type { SettingsItem } from "./client/types.gen.js";

const APPLICATION = "deepalpha";

let cache: SettingsItem[] | null = null;
let inFlight: Promise<SettingsItem[]> | undefined;

export function clearSettingsCache(): void {
  cache = null;
  inFlight = undefined;
}

async function loadSettings(): Promise<SettingsItem[]> {
  if (cache) return cache;
  inFlight ??= getV2SettingsByApplication({ path: { application: APPLICATION } })
    .then(({ data, error }) => {
      if (error || !data?.settings) {
        throw new Error(`Failed to load settings: ${JSON.stringify(error ?? "no settings")}`);
      }
      cache = data.settings;
      return cache;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

function getValue<T = unknown>(settings: SettingsItem[], name: string): T | undefined {
  return settings.find((s) => s.name === name)?.value as T | undefined;
}

/** Full tenant settings array (cached) — for the Settings explorer section. */
export async function getAllSettings(): Promise<SettingsItem[]> {
  return loadSettings();
}

/** Available investor countries (from roboAdvice.countries). */
export async function countriesConfig(): Promise<string[]> {
  const settings = await loadSettings();
  const v = getValue<{ items?: string[] }>(settings, "roboAdvice.countries");
  return Array.isArray(v?.items) ? v.items : [];
}

export interface ClientInfoField {
  // code is the setting name without the `clientInformation.` prefix, e.g.
  // "name", "country", "additionalData.language". Maps to the investor payload:
  // top-level fields directly, `additionalData.*` into the additionalData object,
  // and `clientType` drives investorType.
  code: string;
  label: string;
  componentType: string; // dropdown | textInput | datepicker | buttonSwitch
  required: boolean;
  options: { value: string; label: string }[];
  // For datepickers: the format the API expects (e.g. "MM.dd.yyyy").
  dateFormat?: string;
}
export interface ClientInformationConfig {
  person: ClientInfoField[];
  company: ClientInfoField[];
}

// Investor form fields, per investor type (roboAdvice.clientInformation.{person,company}).
export async function clientInformationConfig(lang = "en"): Promise<ClientInformationConfig> {
  const settings = await loadSettings();
  const build = (who: "person" | "company"): ClientInfoField[] =>
    (getValue<Record<string, unknown>[]>(settings, `roboAdvice.clientInformation.${who}`) ?? [])
      .filter((f) => f.isEnabled !== false)
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((f) => ({
        code: String(f.name).replace(/^clientInformation\./, ""),
        label: label(f.label, lang),
        componentType: String(f.componentType ?? "textInput"),
        required: f.required === true,
        options: Array.isArray(f.items)
          ? (f.items as Record<string, unknown>[]).map((it) => ({
              value: String(it.activeValue),
              label: label(it.label, lang) || String(it.activeValue),
            }))
          : [],
        ...(typeof f.dateFormat === "string" ? { dateFormat: f.dateFormat } : {}),
      }));
  return { person: build("person"), company: build("company") };
}

// Localized labels look like { en: "...", nl: "...", ... } — pick the requested
// language, falling back to English then any available translation.
function label(l: unknown, lang = "en"): string {
  if (typeof l === "string") return l;
  if (l && typeof l === "object") {
    const obj = l as Record<string, string>;
    return obj[lang] ?? obj.en ?? obj.no ?? Object.values(obj)[0] ?? "";
  }
  return "";
}

export interface LanguagesConfig {
  options: string[];
  default: string;
  descriptions: Record<string, string>;
}

export async function languagesConfig(): Promise<LanguagesConfig> {
  const settings = await loadSettings();
  return {
    options: getValue<string[]>(settings, "supportedLanguages.options") ?? ["en"],
    default: getValue<string>(settings, "supportedLanguages.default") ?? "en",
    descriptions: getValue<Record<string, string>>(settings, "languageDescriptions") ?? {},
  };
}

export interface HorizonOption {
  value: number;
  label: string;
}

// Allowed goal horizons (horizon_value must be one of these — 1..4).
export async function goalHorizonConfig(lang = "en"): Promise<HorizonOption[]> {
  const settings = await loadSettings();
  const items = getValue<Record<string, unknown>[]>(settings, "timeHorizonConfig.items") ?? [];
  return items.map((it) => ({
    value: Number(it.riskHorizonValue),
    label: label(it.label, lang) || String(it.riskHorizonValue),
  }));
}

export interface GoalType {
  type: string;
  label: string;
  iconName: string;
  iconUrl: string;
}

export async function goalTypesConfig(lang = "en"): Promise<GoalType[]> {
  const settings = await loadSettings();
  const found: (GoalType & { order: number })[] = [];
  for (let i = 1; i <= 20; i++) {
    const base = `roboAdviceForm.purposeAndRisk.goals.goal${i}`;
    const type = getValue<string | null>(settings, `${base}.type`);
    if (type == null) continue; // missing slot or disabled (null type)
    const order = getValue<number>(settings, `${base}.order`) ?? i;
    found.push({
      type,
      label: label(getValue(settings, `${base}.translations`), lang) || type,
      iconName: getValue<string>(settings, `${base}.iconName`) ?? "",
      iconUrl: getValue<string>(settings, `${base}.iconUrl`) ?? "",
      order,
    });
  }
  found.sort((a, b) => a.order - b.order);
  return found.map(({ type, label, iconName, iconUrl }) => ({ type, label, iconName, iconUrl }));
}

export interface RiskOption {
  id: number;
  label: string;
}
export interface RiskQuestionConfig {
  expectationOfRisk: { enabled: boolean; options: RiskOption[] };
  riskStrategy: { enabled: boolean; options: RiskOption[] };
}

// Risk options carry either a localized `translations` map (en_gb/nl) or just a
// `title` translation key — fall back to the key's last segment for a label.
function optionLabel(o: Record<string, unknown>, lang = "en"): string {
  const tr = o.translations as Record<string, string> | undefined;
  if (tr && typeof tr === "object") {
    return tr[lang] ?? tr[`${lang}_gb`] ?? tr.en_gb ?? tr.en ?? tr.nl ?? Object.values(tr)[0] ?? String(o.id);
  }
  if (typeof o.title === "string") return o.title.split(".").pop() ?? o.title;
  return String(o.id);
}

export async function riskQuestionConfig(lang = "en"): Promise<RiskQuestionConfig> {
  const settings = await loadSettings();
  const toOptions = (key: string): RiskOption[] =>
    (getValue<Record<string, unknown>[]>(settings, key) ?? []).map((o) => ({
      id: Number(o.id),
      label: optionLabel(o, lang),
    }));
  // risk1 = expectation of risk (always shown); risk2 = risk strategy (toggleable).
  const risk2Hidden = getValue<boolean>(settings, "roboAdviceForm.riskQuestions.isRisk2Hidden") ?? false;
  return {
    expectationOfRisk: {
      enabled: true,
      options: toOptions("roboAdviceForm.purposeAndRisk.expectationOfRisk"),
    },
    riskStrategy: {
      enabled: !risk2Hidden,
      options: toOptions("roboAdviceForm.purposeAndRisk.riskStrategy"),
    },
  };
}

export interface AdvisorNoteFlag {
  enabled: boolean;
  required: boolean;
}
export type AdvisorNotesConfig = Record<string, AdvisorNoteFlag>;

export async function advisorNotesConfig(): Promise<AdvisorNotesConfig> {
  const settings = await loadSettings();
  const flag = (base: string): AdvisorNoteFlag => ({
    enabled: getValue<boolean>(settings, `${base}.enabled`) ?? false,
    required: getValue<boolean>(settings, `${base}.required`) ?? false,
  });
  return {
    adviceInformation: flag("roboAdvice.advisorNotes.adviceInformation"),
    financialSituation: flag("roboAdvice.advisorNotes.financialSituation"),
    goalInformation: flag("roboAdvice.advisorNotes.goalInformation"),
    knowledgeAndExperience: flag("roboAdvice.advisorNotes.knowledgeAndExperience"),
    purposeAndRisk: flag("roboAdvice.advisorNotes.purposeAndRisk"),
    sustainabilityPreference: flag("roboAdvice.sustainability.sustainabilityPreference.advisorNotes"),
  };
}

export interface SustainabilityConfig {
  // Exclusion criteria submitted as preference_criteria.themes (ids).
  exclusionCriteria: { id: string; label: string }[];
  steps: { value: number; label: string }[];
  alignmentCriteria: { key: string; title: string }[];
}

export async function sustainabilityConfig(lang = "en"): Promise<SustainabilityConfig> {
  const settings = await loadSettings();
  const exclusionCriteria = (
    getValue<Record<string, unknown>[]>(settings, "roboAdvice.sustainability.sustainabilityPreference.config") ?? []
  ).map((o) => ({ id: String(o.id), label: label(o.title, lang) || String(o.id) }));
  const steps = (
    getValue<Record<string, unknown>[]>(settings, "roboAdvice.sustainability.alignmentCriteria.stepsScheme") ?? []
  ).map((s) => ({ value: Number(s.value), label: label(s.label, lang) || String(s.value) }));
  const alignmentCriteria: { key: string; title: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    if (!getValue<boolean>(settings, `roboAdvice.sustainability.alignmentCriteria${i}.enabled`)) continue;
    const cfg = getValue<Record<string, unknown>>(settings, `roboAdvice.sustainability.alignmentCriteria${i}.config`);
    alignmentCriteria.push({ key: `alignmentCriteria${i}`, title: label(cfg?.title, lang) || `alignmentCriteria${i}` });
  }
  return { exclusionCriteria, steps, alignmentCriteria };
}

export interface GoalInformationOption {
  value: string;
  label: string;
  // Fields that appear only when this option is selected.
  conditionalFields: GoalInformationField[];
}
export interface GoalInformationField {
  code: string;
  label: string;
  componentType: string;
  goalTypes: string[];
  options: GoalInformationOption[];
}

function mapGoalInfoField(f: Record<string, unknown>, lang = "en"): GoalInformationField {
  return {
    // The API keys goal-information fields by their full setting name (with the
    // `goalInformation.` prefix) — do NOT strip it.
    code: String(f.name),
    label: label(f.label, lang),
    componentType: String(f.componentType ?? "textInput"),
    goalTypes: Array.isArray(f.goalTypes) ? (f.goalTypes as unknown[]).map(String) : [],
    options: Array.isArray(f.items)
      ? (f.items as Record<string, unknown>[]).map((it) => ({
          value: String(it.activeValue),
          label: label(it.label, lang) || String(it.activeValue),
          conditionalFields: Array.isArray(it.conditionalFields)
            ? (it.conditionalFields as Record<string, unknown>[]).map((c) => mapGoalInfoField(c, lang))
            : [],
        }))
      : [],
  };
}

export async function goalInformationConfig(lang = "en"): Promise<GoalInformationField[]> {
  const settings = await loadSettings();
  const fields = getValue<Record<string, unknown>[]>(settings, "roboAdviceForm.goalInformation.fields") ?? [];
  return fields.filter((f) => f.isEnabled !== false).map((f) => mapGoalInfoField(f, lang));
}

export interface AdviceInformationField {
  code: string;
  label: string;
  componentType: string;
  options: { value: string; label: string }[];
}

export async function adviceInformationConfig(lang = "en"): Promise<AdviceInformationField[]> {
  const settings = await loadSettings();
  const fields = getValue<Record<string, unknown>[]>(settings, "roboAdviceForm.adviceInformation.fields") ?? [];
  return fields
    .filter((f) => f.isEnabled !== false)
    .map((f) => ({
      code: String(f.name).replace(/^adviceInformation\./, ""),
      label: label(f.label, lang),
      componentType: String(f.componentType ?? "textInput"),
      options: Array.isArray(f.items)
        ? (f.items as Record<string, unknown>[]).map((it) => ({
            value: String(it.activeValue),
            label: label(it.label, lang),
          }))
        : [],
    }));
}

export interface FinancialSituationField {
  id: string;
  label: string;
  type: string; // numberInput | textInput | textarea | buttonSwitch
  hasAssetClass: boolean;
  // How the value is submitted: "array" = multi-row records keyed by field id
  // (assets/debt); the scalar kinds are stored top-level keyed by field id (liquidity).
  kind: "array" | "number" | "boolean" | "text";
}

type ByCategory = Record<"assets" | "debt" | "liquidity", FinancialSituationField[]>;
export interface FinancialSituationConfig {
  person: ByCategory;
  company: ByCategory;
  assetClasses: { id: string; label: string }[];
}

export async function financialSituationConfig(lang = "en"): Promise<FinancialSituationConfig> {
  const settings = await loadSettings();
  const categories = ["assets", "debt", "liquidity"] as const;
  const build = (who: "person" | "company") =>
    Object.fromEntries(
      categories.map((cat) => {
        const items = getValue<Record<string, unknown>[]>(
          settings,
          `roboAdviceForm.financialSituation.${cat}.${who}`,
        ) ?? [];
        const fields = items
          .filter((i) => i.enabled !== false && typeof i.id === "string")
          .map((i) => {
            const type = typeof i.type === "string" ? i.type : "numberInput";
            // assets/debt are multi-row record arrays; liquidity fields are
            // top-level scalars whose shape depends on the field type.
            const kind: FinancialSituationField["kind"] =
              cat !== "liquidity"
                ? "array"
                : type === "buttonSwitch"
                  ? "boolean"
                  : type === "numberInput"
                    ? "number"
                    : "text";
            return {
              id: String(i.id),
              label: label(i.label, lang),
              type,
              hasAssetClass: cat !== "liquidity",
              kind,
            };
          });
        return [cat, fields];
      }),
    ) as ByCategory;

  // Asset classes are the configured categories. The record's `assetClass` stores
  // the CategoryId (e.g. "C22"); label is the SubAssetClass.
  // /v2/categories isn't marked secured in the spec, so request bearer auth explicitly.
  const { data: catData } = await getV2Categories({ security: [{ scheme: "bearer", type: "http" }] });
  const catItems = (catData as { data?: Record<string, unknown>[] } | undefined)?.data ?? [];
  const assetClasses = catItems
    .filter((c) => c.CategoryId)
    .map((c) => ({
      id: String(c.CategoryId),
      label: String(c.SubAssetClass ?? c.IndexName ?? c.CategoryId),
    }));

  return { person: build("person"), company: build("company"), assetClasses };
}
