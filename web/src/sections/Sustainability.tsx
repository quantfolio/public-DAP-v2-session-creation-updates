import { useEffect, useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SourceInfo } from "@/components/SourceInfo";
import { JsonPreview } from "@/components/JsonPreview";
import type { ApiResult } from "@/lib/api";

interface Config {
  themes: { id: string; label: string }[];
  steps: { value: number; label: string }[];
  alignmentCriteria: { key: string; title: string }[];
}

const EMPTY: Config = { themes: [], steps: [], alignmentCriteria: [] };

export function Sustainability({
  run,
  authed,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  authed: boolean;
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
    fetch("/api/config/sustainability")
      .then((r) => r.json())
      .then((c) =>
        setConfig({
          themes: Array.isArray(c.themes) ? c.themes : [],
          steps: Array.isArray(c.steps) ? c.steps : [],
          alignmentCriteria: Array.isArray(c.alignmentCriteria) ? c.alignmentCriteria : [],
        }),
      )
      .catch(() => setConfig(EMPTY));
  }, [authed]);

  function toggleTheme(id: string) {
    setThemes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  const body = {
    generic: { answer: genericAnswer === "" ? null : genericAnswer === "true", comment: genericComment || null },
    preference_criteria: { advisor_notes: prefNotes || null, themes },
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
            { label: "Themes", value: "settings → themes" },
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

        {/* Preference criteria — themes */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Preference themes</p>
          <div className="flex flex-wrap gap-3">
            {config.themes.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={themes.includes(t.id)} onChange={() => toggleTheme(t.id)} />
                {t.label} <span className="text-muted-foreground">({t.id})</span>
              </label>
            ))}
          </div>
          <Input
            placeholder="preference advisor notes (optional)"
            value={prefNotes}
            onChange={(e) => setPrefNotes(e.target.value)}
          />
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

        <JsonPreview value={body} />
        <RunButton onRun={() => run("PUT", "/api/sustainability", body)}>Submit</RunButton>
      </CardContent>
    </Card>
  );
}
