import { useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SourceInfo } from "@/components/SourceInfo";
import { PayloadTabs } from "@/components/PayloadTabs";
import { apiCall, type ApiResult } from "@/lib/api";

interface Column {
  id: number;
  label: string | null;
  description: string | null;
}
interface TableMeta {
  name: string;
  label: string | null;
  options: Column[];
}
interface Meta {
  enabled: boolean;
  checks: { id: string; label: string | null }[];
  table_order: string[];
  tables: TableMeta[];
}
type Answers = Record<string, Record<string, number>>; // table -> check -> optionId

export function AdvancedSuitability({
  run,
  sessionId,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  sessionId: string;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [checksTraining, setChecksTraining] = useState<Record<string, boolean>>({});
  const [quizEnabled, setQuizEnabled] = useState(false);

  async function load() {
    const r = await run("GET", "/api/advanced-suitability");
    const body = r.body as { data?: { answers?: Answers; checks_training?: Record<string, boolean> }; meta?: Meta } | null;
    setMeta(body?.meta ?? null);
    setAnswers(body?.data?.answers ?? {});
    setChecksTraining(body?.data?.checks_training ?? {});
    // The `knowledge` check is assessed via the quiz when it's enabled — don't
    // render it as a manual matrix then (see the Knowledge quiz section).
    const q = await apiCall("GET", "/api/quiz", sessionId);
    setQuizEnabled((q.body as { meta?: { enabled?: boolean } } | null)?.meta?.enabled === true);
  }

  const setCell = (table: string, check: string, optionId: number) =>
    setAnswers((p) => ({ ...p, [table]: { ...p[table], [check]: optionId } }));

  // Loaded answers (incl. quiz-derived `knowledge`) are preserved in the PUT body.
  const body = { answers, checks_training: checksTraining };
  const tables = (
    meta ? (meta.table_order.map((n) => meta.tables.find((t) => t.name === n)).filter(Boolean) as TableMeta[]) : []
  ).filter((t) => !(quizEnabled && t.name === "knowledge"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced suitability</CardTitle>
        <CardDescription>GET / PUT /advanced_suitability · knowledge / experience matrices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            { label: "Endpoint", value: "GET·PUT /v2/advice_session/{session_id}/advanced_suitability" },
            { label: "Config", value: "GET response → meta.tables (columns) + meta.checks (rows)" },
            { label: "Status", value: "GET …/advanced_suitability/status (computed; 400 until complete)" },
            { label: "Body", value: "{ answers: { [table]: { [check]: optionId } }, checks_training }" },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load
        </RunButton>

        {meta && !meta.enabled && (
          <p className="text-sm text-muted-foreground">Advanced suitability is disabled for this tenant.</p>
        )}

        {tables.map((t) => (
          <div key={t.name} className="space-y-1.5">
            <p className="text-sm font-semibold">
              {t.label || t.name} <span className="text-muted-foreground">({t.name})</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-1.5 text-left font-medium text-muted-foreground" />
                    {t.options.map((c) => (
                      <th key={c.id} className="p-1.5 text-center font-medium" title={c.description ?? undefined}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(meta?.checks ?? []).map((check, i) => (
                    <tr key={check.id} className={i % 2 ? "bg-muted/40" : ""}>
                      <td className="p-1.5">{check.label ?? check.id}</td>
                      {t.options.map((c) => (
                        <td key={c.id} className="p-1.5 text-center">
                          <input
                            type="radio"
                            name={`${t.name}-${check.id}`}
                            checked={answers[t.name]?.[check.id] === c.id}
                            onChange={() => setCell(t.name, check.id, c.id)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {meta?.enabled && quizEnabled && (
          <p className="text-xs text-muted-foreground">
            The <code>knowledge</code> check ("Basic knowledge per product category") is assessed via the{" "}
            <strong>Knowledge quiz</strong> section — its <code>suitability.knowledge</code> value is derived from
            the quiz result, so it's not shown as a manual matrix here.
          </p>
        )}

        {meta?.enabled && (
          <>
            <PayloadTabs
              payload={body}
              code={`// Load config + current answers, then PUT the matrix\nconst { data, meta } = await fetch(\`\${BASE}/v2/advice_session/\${sessionId}/advanced_suitability\`, { headers: auth }).then(r => r.json());\n// answers keyed by table -> check -> option id (from meta.tables / meta.checks)\nawait fetch(\`\${BASE}/v2/advice_session/\${sessionId}/advanced_suitability\`, {\n  method: "PUT", headers: auth,\n  body: JSON.stringify({ answers, checks_training }),\n});`}
              endpoint={{ method: "PUT", path: "/v2/advice_session/{session_id}/advanced_suitability" }}
            />
            <div className="flex gap-2">
              <RunButton onRun={() => run("PUT", "/api/advanced-suitability", body)}>Save</RunButton>
              <RunButton variant="secondary" onRun={() => run("GET", "/api/advanced-suitability/status")}>
                Compute status
              </RunButton>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
