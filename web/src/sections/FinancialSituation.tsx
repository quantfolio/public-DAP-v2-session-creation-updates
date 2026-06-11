import { useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PayloadTabs } from "@/components/PayloadTabs";
import { SourceInfo } from "@/components/SourceInfo";
import { AdvisorNotesField, type AdvisorNoteFlag } from "@/components/AdvisorNotesField";
import { financialSituationCode } from "@/lib/codegen";
import type { ApiResult } from "@/lib/api";

type Category = "assets" | "debt" | "liquidity";
const CATEGORIES: Category[] = ["assets", "debt", "liquidity"];
type Who = "person" | "company";

interface Field {
  id: string;
  label: string;
  type: string; // numberInput | textInput | textarea | buttonSwitch
  hasAssetClass: boolean;
  kind: "array" | "number" | "boolean" | "text";
}
type Catalog = Record<Category, Field[]>;
interface AssetClass {
  id: string;
  label: string;
}
// An array-field record: own UUID id; a field can hold multiple records.
interface Entry {
  id: string;
  value: string;
  title: string;
  assetClass: string;
}
type Values = Record<string, Entry[]>; // array fields, keyed by field id

interface FinancialSituationConfig {
  person: Catalog;
  company: Catalog;
  assetClasses: AssetClass[];
}

const newEntry = (): Entry => ({ id: crypto.randomUUID(), value: "", title: "", assetClass: "" });
const flatten = (c: Catalog): Field[] => CATEGORIES.flatMap((cat) => c[cat]);

export function FinancialSituation({
  run,
  lang,
  notesFlag,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  lang: string;
  notesFlag?: AdvisorNoteFlag;
}) {
  const [catalogs, setCatalogs] = useState<{ person: Catalog; company: Catalog } | null>(null);
  const [who, setWho] = useState<Who>("person");
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [values, setValues] = useState<Values>({}); // array fields
  const [scalars, setScalars] = useState<Record<string, string>>({}); // scalar fields
  const [advisorNotes, setAdvisorNotes] = useState("");

  const catalog = catalogs?.[who] ?? null;
  const entriesFor = (fieldId: string): Entry[] => values[fieldId] ?? [];
  const isFilled = (e: Entry) => e.value !== "" || e.title !== "" || e.assetClass !== "";
  const setScalar = (id: string, v: string) => setScalars((p) => ({ ...p, [id]: v }));

  function patchEntry(fieldId: string, idx: number, patch: Partial<Entry>) {
    setValues((p) => {
      const arr = [...(p[fieldId] ?? [])];
      arr[idx] = { ...arr[idx], ...patch };
      if (idx === arr.length - 1 && isFilled(arr[idx])) arr.push(newEntry());
      return { ...p, [fieldId]: arr };
    });
  }
  function removeEntry(fieldId: string, idx: number) {
    setValues((p) => {
      const arr = (p[fieldId] ?? []).filter((_, i) => i !== idx);
      if (arr.length === 0 || isFilled(arr[arr.length - 1])) arr.push(newEntry());
      return { ...p, [fieldId]: arr };
    });
  }

  async function load() {
    const config: FinancialSituationConfig = await fetch(
      `/api/config/financial-situation?lang=${lang}`,
    ).then((r) => r.json());
    setCatalogs({ person: config.person, company: config.company });
    setAssetClasses(Array.isArray(config.assetClasses) ? config.assetClasses : []);

    // Infer the subject from the investor attached to the active session.
    const inferred = await run("GET", "/api/session-investor");
    const type = (inferred.body as { investorType?: string } | null)?.investorType;
    if (type === "person" || type === "company") setWho(type);

    const r = await run("GET", "/api/financial-situation");
    const data = (
      r.body as {
        data?: { financial_situation?: Record<string, unknown>; advisor_notes?: string | null };
      } | null
    )?.data;
    setAdvisorNotes(data?.advisor_notes ?? "");
    const fs = data?.financial_situation ?? {};

    // Prefill across both catalogs (field ids overlap; the GET holds one object).
    const nextValues: Values = {};
    const nextScalars: Record<string, string> = {};
    const seen = new Set<string>();
    for (const f of [...flatten(config.person), ...flatten(config.company)]) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if (f.kind === "array") {
        const recs = fs[f.id];
        const mapped = Array.isArray(recs)
          ? (recs as { id: string; value?: number | null; title?: string | null; assetClass?: string | null }[]).map(
              (rec) => ({
                id: String(rec.id),
                value: rec.value != null ? String(rec.value) : "",
                title: rec.title ?? "",
                assetClass: rec.assetClass ?? "",
              }),
            )
          : [];
        if (mapped.length === 0 || isFilled(mapped[mapped.length - 1])) mapped.push(newEntry());
        nextValues[f.id] = mapped;
      } else {
        const v = fs[f.id];
        if (v !== undefined && v !== null) nextScalars[f.id] = String(v);
      }
    }
    setValues(nextValues);
    setScalars(nextScalars);
  }

  function buildBody() {
    // Keyed by field id, inside {person|company}_financial_situation. Array fields
    // (assets/debt) → record arrays with a trailing { id } placeholder; scalar
    // fields (liquidity) → a top-level number / boolean / string.
    const fs: Record<string, unknown> = {};
    if (catalog) {
      for (const cat of CATEGORIES) {
        for (const f of catalog[cat]) {
          if (f.kind === "array") {
            const entries = values[f.id] ?? [];
            if (!entries.some((e) => e.value !== "")) continue;
            fs[f.id] = entries.map((e) => {
              if (e.value === "") return { id: e.id };
              const rec: Record<string, unknown> = { id: e.id, value: Number(e.value), title: e.title || null };
              if (f.hasAssetClass) rec.assetClass = e.assetClass || null;
              return rec;
            });
          } else {
            const raw = scalars[f.id];
            if (raw === undefined || raw === "") continue;
            fs[f.id] = f.kind === "number" ? Number(raw) : f.kind === "boolean" ? raw === "true" : raw;
          }
        }
      }
    }
    return {
      advisor_notes: notesFlag?.enabled ? advisorNotes || null : null,
      [`${who}_financial_situation`]: fs,
    };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial situation</CardTitle>
        <CardDescription>GET / PATCH /financial-situation · fields from settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            {
              label: "Endpoint",
              value: "GET·PATCH /v2/advice_session/{session_id}/financial_situation",
            },
            {
              label: "Fields",
              value: "settings → roboAdviceForm.financialSituation.{assets,debt,liquidity}.{person,company}",
            },
            { label: "Asset class", value: "GET /v2/categories → CategoryId (label = SubAssetClass)" },
            { label: "Body", value: "{who}_financial_situation: { fieldId: [...] | scalar }" },
          ]}
          drift="assets/debt are record arrays keyed by field id (per-row UUIDs, camelCase assetClass); liquidity fields are top-level scalars. /v2/categories needs auth though the spec doesn't mark it secured."
        />
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="fs-who">Subject</Label>
            <NativeSelect id="fs-who" value={who} onChange={(e) => setWho(e.target.value as Who)}>
              <option value="person">person</option>
              <option value="company">company</option>
            </NativeSelect>
          </div>
          <RunButton variant="secondary" onRun={load}>
            Load fields
          </RunButton>
        </div>

        {catalog &&
          CATEGORIES.map((cat) => (
            <div key={cat} className="space-y-2">
              <p className="text-sm font-semibold capitalize">{cat}</p>
              {catalog[cat].length === 0 && (
                <p className="text-xs text-muted-foreground">No fields configured.</p>
              )}
              {catalog[cat].map((f) =>
                f.kind === "array" ? (
                  <div key={f.id} className="space-y-1.5 rounded-md border p-2">
                    <Label className="font-normal">{f.label || f.id}</Label>
                    {entriesFor(f.id).map((entry, idx) => (
                      <div
                        key={entry.id}
                        className={
                          "grid items-center gap-2 " +
                          (f.hasAssetClass ? "grid-cols-[1fr_1fr_1fr_2rem]" : "grid-cols-[1fr_1fr_2rem]")
                        }
                      >
                        <Input
                          placeholder="name"
                          value={entry.title}
                          onChange={(e) => patchEntry(f.id, idx, { title: e.target.value })}
                        />
                        <Input
                          type="number"
                          placeholder="amount"
                          value={entry.value}
                          onChange={(e) => patchEntry(f.id, idx, { value: e.target.value })}
                        />
                        {f.hasAssetClass && (
                          <NativeSelect
                            value={entry.assetClass}
                            onChange={(e) => patchEntry(f.id, idx, { assetClass: e.target.value })}
                          >
                            <option value="">asset class…</option>
                            {assetClasses.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                        {idx < entriesFor(f.id).length - 1 ? (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeEntry(f.id, idx)}>
                            <X />
                          </Button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div key={f.id} className="space-y-1.5 rounded-md border p-2">
                    <Label className="font-normal">{f.label || f.id}</Label>
                    {f.kind === "boolean" ? (
                      <NativeSelect value={scalars[f.id] ?? ""} onChange={(e) => setScalar(f.id, e.target.value)}>
                        <option value="">— select —</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </NativeSelect>
                    ) : (
                      <Input
                        type={f.kind === "number" ? "number" : "text"}
                        placeholder={f.kind === "number" ? "amount" : "value"}
                        value={scalars[f.id] ?? ""}
                        onChange={(e) => setScalar(f.id, e.target.value)}
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          ))}

        <AdvisorNotesField flag={notesFlag} value={advisorNotes} onChange={setAdvisorNotes} />
        <PayloadTabs
          payload={buildBody()}
          code={financialSituationCode()}
          endpoint={{ method: "PATCH", path: "/v2/advice_session/{session_id}/financial_situation" }}
        />
        <RunButton onRun={() => run("PATCH", "/api/financial-situation", buildBody())}>
          Patch
        </RunButton>
      </CardContent>
    </Card>
  );
}
