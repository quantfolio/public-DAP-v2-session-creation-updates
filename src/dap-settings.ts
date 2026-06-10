// Extracts form/field configuration from the tenant settings so the dev-tool UI
// can render intuitive inputs instead of raw JSON.
//
// Settings are fetched live from GET /v2/settings/deepalpha (for the authenticated
// tenant) and cached in-memory. Call clearSettingsCache() on login/logout so a
// different tenant's settings are re-fetched.
import { getV2SettingsByApplication } from "./client/sdk.gen.js";
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

// Localized labels look like { en: "...", nl: "...", ... } — prefer English.
function label(l: unknown): string {
  if (typeof l === "string") return l;
  if (l && typeof l === "object") {
    const obj = l as Record<string, string>;
    return obj.en ?? obj.no ?? Object.values(obj)[0] ?? "";
  }
  return "";
}

export interface GoalType {
  type: string;
  label: string;
  iconName: string;
  iconUrl: string;
}

export async function goalTypesConfig(): Promise<GoalType[]> {
  const settings = await loadSettings();
  const found: (GoalType & { order: number })[] = [];
  for (let i = 1; i <= 20; i++) {
    const base = `roboAdviceForm.purposeAndRisk.goals.goal${i}`;
    const type = getValue<string | null>(settings, `${base}.type`);
    if (type == null) continue; // missing slot or disabled (null type)
    const order = getValue<number>(settings, `${base}.order`) ?? i;
    found.push({
      type,
      label: label(getValue(settings, `${base}.translations`)) || type,
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
function optionLabel(o: Record<string, unknown>): string {
  const tr = o.translations as Record<string, string> | undefined;
  if (tr && typeof tr === "object") {
    return tr.en_gb ?? tr.en ?? tr.nl ?? Object.values(tr)[0] ?? String(o.id);
  }
  if (typeof o.title === "string") return o.title.split(".").pop() ?? o.title;
  return String(o.id);
}

export async function riskQuestionConfig(): Promise<RiskQuestionConfig> {
  const settings = await loadSettings();
  const toOptions = (key: string): RiskOption[] =>
    (getValue<Record<string, unknown>[]>(settings, key) ?? []).map((o) => ({
      id: Number(o.id),
      label: optionLabel(o),
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

export interface SustainabilityConfig {
  themes: { id: string; label: string }[];
  steps: { value: number; label: string }[];
  alignmentCriteria: { key: string; title: string }[];
}

export async function sustainabilityConfig(): Promise<SustainabilityConfig> {
  const settings = await loadSettings();
  const themes = (getValue<Record<string, unknown>[]>(settings, "themes") ?? []).map((t) => ({
    id: String(t.id),
    label: typeof t.title === "string" ? (t.title.split(".").pop() ?? t.title) : String(t.id),
  }));
  const steps = (
    getValue<Record<string, unknown>[]>(settings, "roboAdvice.sustainability.alignmentCriteria.stepsScheme") ?? []
  ).map((s) => ({ value: Number(s.value), label: label(s.label) || String(s.value) }));
  const alignmentCriteria: { key: string; title: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    if (!getValue<boolean>(settings, `roboAdvice.sustainability.alignmentCriteria${i}.enabled`)) continue;
    const cfg = getValue<Record<string, unknown>>(settings, `roboAdvice.sustainability.alignmentCriteria${i}.config`);
    alignmentCriteria.push({ key: `alignmentCriteria${i}`, title: label(cfg?.title) || `alignmentCriteria${i}` });
  }
  return { themes, steps, alignmentCriteria };
}

export interface GoalInformationField {
  code: string;
  label: string;
  componentType: string;
  goalTypes: string[];
  options: { value: string; label: string }[];
}

export async function goalInformationConfig(): Promise<GoalInformationField[]> {
  const settings = await loadSettings();
  const fields = getValue<Record<string, unknown>[]>(settings, "roboAdviceForm.goalInformation.fields") ?? [];
  return fields
    .filter((f) => f.isEnabled !== false)
    .map((f) => ({
      code: String(f.name).replace(/^goalInformation\./, ""),
      label: label(f.label),
      componentType: String(f.componentType ?? "textInput"),
      goalTypes: Array.isArray(f.goalTypes) ? (f.goalTypes as unknown[]).map(String) : [],
      options: Array.isArray(f.items)
        ? (f.items as Record<string, unknown>[]).map((it) => ({
            value: String(it.activeValue),
            label: label(it.label) || String(it.activeValue),
          }))
        : [],
    }));
}

export interface AdviceInformationField {
  code: string;
  label: string;
  componentType: string;
  options: { value: string; label: string }[];
}

export async function adviceInformationConfig(): Promise<AdviceInformationField[]> {
  const settings = await loadSettings();
  const fields = getValue<Record<string, unknown>[]>(settings, "roboAdviceForm.adviceInformation.fields") ?? [];
  return fields
    .filter((f) => f.isEnabled !== false)
    .map((f) => ({
      code: String(f.name).replace(/^adviceInformation\./, ""),
      label: label(f.label),
      componentType: String(f.componentType ?? "textInput"),
      options: Array.isArray(f.items)
        ? (f.items as Record<string, unknown>[]).map((it) => ({
            value: String(it.activeValue),
            label: label(it.label),
          }))
        : [],
    }));
}

export interface FinancialSituationField {
  id: string;
  label: string;
}

export type FinancialSituationConfig = Record<
  "person" | "company",
  Record<"assets" | "debt" | "liquidity", FinancialSituationField[]>
>;

export async function financialSituationConfig(): Promise<FinancialSituationConfig> {
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
          .map((i) => ({ id: String(i.id), label: label(i.label) }));
        return [cat, fields];
      }),
    ) as Record<"assets" | "debt" | "liquidity", FinancialSituationField[]>;
  return { person: build("person"), company: build("company") };
}
