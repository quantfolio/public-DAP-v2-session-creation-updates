import { useState } from "react";
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
import { PayloadTabs } from "@/components/PayloadTabs";
import { SourceInfo } from "@/components/SourceInfo";
import { AdvisorNotesField, type AdvisorNoteFlag } from "@/components/AdvisorNotesField";
import { adviceInformationCode } from "@/lib/codegen";
import type { ApiResult } from "@/lib/api";

interface FieldDef {
  code: string;
  label: string | null;
  type: string;
  required: boolean;
  depends_on: { code: string; value: string } | null;
  options: { label: string; value: string }[];
}

export function AdviceInformation({
  run,
  notesFlag,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  notesFlag?: AdvisorNoteFlag;
}) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [advisorNotes, setAdvisorNotes] = useState("");
  const notes = notesFlag?.enabled ? advisorNotes || null : null;

  async function load() {
    const r = await run("GET", "/api/advice-information");
    const body = r.body as
      | {
          data?: { advisor_notes?: string | null; answers?: { code: string; value: string | null }[] };
          meta?: { fields?: FieldDef[] };
        }
      | null;
    setFields(body?.meta?.fields ?? []);
    setAdvisorNotes(body?.data?.advisor_notes ?? "");
    const vals: Record<string, string> = {};
    for (const a of body?.data?.answers ?? []) if (a.value != null) vals[a.code] = a.value;
    setValues(vals);
  }

  // A field shows only if its dependency (if any) is satisfied.
  const isVisible = (f: FieldDef) => !f.depends_on || values[f.depends_on.code] === f.depends_on.value;
  const visibleFields = fields.filter(isVisible);
  // PATCH body mirrors the GET: { data: { advisor_notes, answers: [{ code, value }] } }
  const answers = visibleFields
    .filter((f) => (values[f.code] ?? "") !== "")
    .map((f) => ({ code: f.code, value: values[f.code] }));
  const body = { data: { advisor_notes: notes, answers } };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advice information</CardTitle>
        <CardDescription>GET / PATCH /advice-information · fields from the GET response</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SourceInfo
          items={[
            {
              label: "Endpoint",
              value: "GET·PATCH /v2/advice_session/{session_id}/advice_information",
            },
            { label: "Fields", value: "GET response → meta.fields (code, type, options, depends_on)" },
          ]}
          drift="PATCH body is { data: { advisor_notes, answers: [{code, value}] } }, and the GET returns meta.fields — both unlike the spec."
        />
        <RunButton variant="secondary" onRun={load}>
          Load fields
        </RunButton>

        {visibleFields.map((f) => (
          <div key={f.code} className="space-y-1.5">
            <Label>
              {f.label ?? f.code}
              {f.required ? " *" : ""}
            </Label>
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
                type={f.type === "numberInput" ? "number" : "text"}
                value={values[f.code] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [f.code]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <AdvisorNotesField flag={notesFlag} value={advisorNotes} onChange={setAdvisorNotes} />
        <PayloadTabs
          payload={body}
          code={adviceInformationCode()}
          endpoint={{ method: "PATCH", path: "/v2/advice_session/{session_id}/advice_information" }}
        />
        <RunButton onRun={() => run("PATCH", "/api/advice-information", body)}>Patch</RunButton>
      </CardContent>
    </Card>
  );
}
