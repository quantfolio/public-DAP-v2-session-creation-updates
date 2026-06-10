import { useState } from "react";
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
import { JsonPreview } from "@/components/JsonPreview";
import { SourceInfo } from "@/components/SourceInfo";
import type { ApiResult } from "@/lib/api";

interface LiveField {
  code: string;
  label: string;
  type: string;
  value: string | null;
}
interface ConfigField {
  code: string;
  label: string;
  componentType: string;
  options: { value: string; label: string }[];
}

// Settings codes can be stale (e.g. prefixed), so match on suffix either way.
function matchOptions(code: string, config: ConfigField[]) {
  const hit = config.find(
    (c) => c.code === code || c.code.endsWith(code) || code.endsWith(c.code),
  );
  return hit?.options ?? [];
}

export function AdviceInformation({
  run,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
}) {
  const [fields, setFields] = useState<(LiveField & { options: { value: string; label: string }[] })[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [advisorNotes, setAdvisorNotes] = useState("");

  async function load() {
    const r = await run("GET", "/api/advice-information");
    const live = (r.body as { data?: LiveField[] } | null)?.data ?? [];
    const config: ConfigField[] = await fetch("/api/config/advice-information").then((res) => res.json());
    const merged = live.map((f) => ({ ...f, options: matchOptions(f.code, config) }));
    setFields(merged);
    const prefilled: Record<string, string> = {};
    for (const f of live) if (f.value != null) prefilled[f.code] = f.value;
    setValues(prefilled);
  }

  const fieldsBody = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ""));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advice information</CardTitle>
        <CardDescription>GET / PATCH /advice-information · options from settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SourceInfo
          items={[
            {
              label: "Endpoint",
              value: "GET·PATCH /v2/advice_session/{session_id}/advice_information",
            },
            { label: "Options", value: "settings → roboAdviceForm.adviceInformation.fields" },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load fields
        </RunButton>

        {fields.map((f) => (
          <div key={f.code} className="space-y-1.5">
            <Label>{f.label}</Label>
            {f.options.length > 0 ? (
              <Select
                value={values[f.code] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [f.code]: e.target.value }))}
              >
                <option value="">— select —</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={values[f.code] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [f.code]: e.target.value }))}
              />
            )}
          </div>
        ))}

        {fields.length > 0 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ai-notes">Advisor notes</Label>
              <Input id="ai-notes" value={advisorNotes} onChange={(e) => setAdvisorNotes(e.target.value)} />
            </div>
            <JsonPreview value={{ advisor_notes: advisorNotes || null, fields: fieldsBody }} />
            <RunButton
              onRun={() =>
                run("PATCH", "/api/advice-information", {
                  advisor_notes: advisorNotes || null,
                  fields: fieldsBody,
                })
              }
            >
              Patch
            </RunButton>
          </>
        )}
      </CardContent>
    </Card>
  );
}
