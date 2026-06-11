import { useEffect, useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect as Select } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SourceInfo } from "@/components/SourceInfo";
import { PayloadTabs } from "@/components/PayloadTabs";
import { AdvisorNotesField, type AdvisorNoteFlag } from "@/components/AdvisorNotesField";
import { sustainabilityCode } from "@/lib/codegen";
import type { ApiResult } from "@/lib/api";

interface Config {
  exclusionCriteria: { id: string; label: string }[];
  steps: { value: number; label: string }[];
  alignmentCriteria: { key: string; title: string }[];
}

const EMPTY: Config = { exclusionCriteria: [], steps: [], alignmentCriteria: [] };

export function Sustainability({
  run,
  authed,
  lang,
  notesFlag,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  authed: boolean;
  lang: string;
  notesFlag?: AdvisorNoteFlag;
}) {
  const [config, setConfig] = useState<Config>(EMPTY);
  const [genericAnswer, setGenericAnswer] = useState(""); // "", "true", "false"
  const [genericComment, setGenericComment] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [prefNotes, setPrefNotes] = useState("");
  const [alignValues, setAlignValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authed) {
      setConfig(EMPTY);
      return;
    }
    fetch(`/api/config/sustainability?lang=${lang}`)
      .then((r) => r.json())
      .then((c) =>
        setConfig({
          exclusionCriteria: Array.isArray(c.exclusionCriteria) ? c.exclusionCriteria : [],
          steps: Array.isArray(c.steps) ? c.steps : [],
          alignmentCriteria: Array.isArray(c.alignmentCriteria) ? c.alignmentCriteria : [],
        }),
      )
      .catch(() => setConfig(EMPTY));
  }, [authed, lang]);

  function toggleExclusion(id: string) {
    setThemes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  const body = {
    generic: { answer: genericAnswer === "" ? null : genericAnswer === "true", comment: genericComment || null },
    preference_criteria: { advisor_notes: notesFlag?.enabled ? prefNotes || null : null, themes },
    alignment_criteria: Object.fromEntries(
      config.alignmentCriteria
        .filter((c) => (alignValues[c.key] ?? "") !== "")
        .map((c) => [c.key, { advisor_notes: null, value: Number(alignValues[c.key]) }]),
    ),
  };

  async function load() {
    const r = await run("GET", "/api/sustainability");
    const d = (r.body as { data?: Record<string, unknown> } | null)?.data;
    const g = d?.generic as { answer?: boolean | null; comment?: string | null } | null;
    setGenericAnswer(g?.answer == null ? "" : String(g.answer));
    setGenericComment(g?.comment ?? "");
    const pref = d?.preference_criteria as { advisor_notes?: string | null; themes?: string[] } | null;
    setThemes(Array.isArray(pref?.themes) ? pref!.themes : []);
    setPrefNotes(pref?.advisor_notes ?? "");
    const align = (d?.alignment_criteria ?? {}) as Record<string, { value?: number | null } | null>;
    const vals: Record<string, string> = {};
    for (const [k, v] of Object.entries(align)) if (v?.value != null) vals[k] = String(v.value);
    setAlignValues(vals);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sustainability</CardTitle>
        <CardDescription>GET / PUT /sustainability · options from settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            { label: "Endpoint", value: "GET·PUT /v2/advice_session/{session_id}/sustainability" },
            { label: "Exclusions", value: "settings → roboAdvice.sustainability.sustainabilityPreference.config" },
            { label: "Alignment", value: "settings → roboAdvice.sustainability.alignmentCriteria{N}" },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load current
        </RunButton>

        {/* Generic assessment */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Generic assessment</p>
          <div className="space-y-1.5">
            <Label>Has sustainability preferences?</Label>
            <Select value={genericAnswer} onChange={(e) => setGenericAnswer(e.target.value)}>
              <option value="">— not answered —</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </div>
          <Input
            placeholder="comment (optional)"
            value={genericComment}
            onChange={(e) => setGenericComment(e.target.value)}
          />
        </div>

        {/* Preference criteria — exclusion criteria (sent as preference_criteria.themes) */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Exclusion criteria</p>
          <div className="flex flex-wrap gap-3">
            {config.exclusionCriteria.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={themes.includes(t.id)} onChange={() => toggleExclusion(t.id)} />
                {t.label} <span className="text-muted-foreground">({t.id})</span>
              </label>
            ))}
          </div>
          <AdvisorNotesField flag={notesFlag} value={prefNotes} onChange={setPrefNotes} />
        </div>

        {/* Alignment criteria */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Alignment criteria</p>
          {config.alignmentCriteria.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <Label>{c.title}</Label>
              <Select
                value={alignValues[c.key] ?? ""}
                onChange={(e) => setAlignValues((p) => ({ ...p, [c.key]: e.target.value }))}
              >
                <option value="">— select —</option>
                {config.steps.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.value})
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <PayloadTabs
          payload={body}
          code={sustainabilityCode()}
          endpoint={{ method: "PUT", path: "/v2/advice_session/{session_id}/sustainability" }}
        />
        <RunButton onRun={() => run("PUT", "/api/sustainability", body)}>Submit</RunButton>
      </CardContent>
    </Card>
  );
}
