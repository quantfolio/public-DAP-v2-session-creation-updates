import { useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SourceInfo } from "@/components/SourceInfo";
import { PayloadTabs } from "@/components/PayloadTabs";
import type { ApiResult } from "@/lib/api";

interface Availability {
  attempts_remaining: number;
  can_attempt: boolean;
  cooldown_until: string | null;
}
interface InvestorState {
  investor_id: string;
  attempts_count: number;
  availability: Availability;
  last_attempt_at: string | null;
  last_attempt_passed: boolean | null;
}
interface CheckState {
  check_id: string;
  aggregate_status: string;
  suitability_value: number | null;
  investors: InvestorState[];
}
interface Investor {
  id: string;
  name: string | null;
}
interface QOption {
  id: string;
  label: string | null;
}
interface QQuestion {
  id: string;
  label: string | null;
  options: QOption[];
}
interface QCategory {
  id: string;
  label: string | null;
  number_of_questions_to_ask: number;
  questions: QQuestion[];
}
interface QMeta {
  enabled: boolean;
  max_attempts: number;
  attempt_reset_days: number;
  whole_quiz_required: boolean;
  required_checks: string[];
  checks: { check_id: string; categories: QCategory[] }[];
}

export function Quiz({
  run,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
}) {
  const [data, setData] = useState<{ investors: Investor[]; checks: CheckState[] } | null>(null);
  const [meta, setMeta] = useState<QMeta | null>(null);
  const [check, setCheck] = useState("");
  const [investor, setInvestor] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function load() {
    const r = await run("GET", "/api/quiz");
    const body = r.body as { data?: { investors: Investor[]; checks: CheckState[] }; meta?: QMeta } | null;
    setData(body?.data ?? null);
    setMeta(body?.meta ?? null);
    setCheck((prev) => prev || body?.meta?.required_checks?.[0] || body?.meta?.checks?.[0]?.check_id || "");
    setInvestor((prev) => prev || body?.data?.investors?.[0]?.id || "");
    setAnswers({});
  }

  const metaCheck = meta?.checks.find((c) => c.check_id === check);
  const questions = metaCheck ? metaCheck.categories.flatMap((cat) => cat.questions) : [];
  const attemptBody = {
    check_id: check,
    investor_id: investor,
    answers: questions.map((q) => ({ question_id: q.id, selected_option_id: answers[q.id] ?? null })),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge quiz</CardTitle>
        <CardDescription>GET /quiz · POST /quiz/attempts · per-check assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            { label: "Endpoint", value: "GET /v2/advice_session/{session_id}/quiz" },
            { label: "Submit", value: "POST …/quiz/attempts { check_id, investor_id, answers[] }" },
            { label: "Meta", value: "meta.checks[].categories[].questions (graded server-side)" },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load
        </RunButton>

        {meta && !meta.enabled && <p className="text-sm text-muted-foreground">Quiz is disabled for this tenant.</p>}

        {/* Overview */}
        {data && meta?.enabled && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1.5 font-medium">Check</th>
                  <th className="p-1.5 font-medium">Status</th>
                  <th className="p-1.5 font-medium">Suitability</th>
                  <th className="p-1.5 font-medium">Per investor (attempts · passed · can retry)</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map((c, i) => (
                  <tr key={c.check_id} className={i % 2 ? "bg-muted/40" : ""}>
                    <td className="p-1.5">
                      {c.check_id}
                      {meta.required_checks.includes(c.check_id) && <span className="text-red-600"> *</span>}
                    </td>
                    <td className="p-1.5">{c.aggregate_status}</td>
                    <td className="p-1.5">{c.suitability_value ?? "—"}</td>
                    <td className="p-1.5">
                      {c.investors
                        .map(
                          (iv) =>
                            `${iv.investor_id}: ${iv.attempts_count}/${meta.max_attempts} · ${iv.last_attempt_passed === null ? "—" : iv.last_attempt_passed ? "pass" : "fail"} · ${iv.availability.can_attempt ? "yes" : "no"}`,
                        )
                        .join("  |  ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Take a quiz */}
        {meta?.enabled && metaCheck && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-check">Check</Label>
                <NativeSelect id="q-check" value={check} onChange={(e) => { setCheck(e.target.value); setAnswers({}); }}>
                  {meta.checks.map((c) => (
                    <option key={c.check_id} value={c.check_id}>
                      {c.check_id}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-inv">Investor</Label>
                <NativeSelect id="q-inv" value={investor} onChange={(e) => setInvestor(e.target.value)}>
                  {(data?.investors ?? []).map((iv) => (
                    <option key={iv.id} value={iv.id}>
                      {iv.name ?? iv.id}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-1">
                <p className="text-sm font-medium">
                  {idx + 1}. {q.label}
                </p>
                <div className="grid gap-1">
                  {q.options.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === o.id}
                        onChange={() => setAnswers((p) => ({ ...p, [q.id]: o.id }))}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <PayloadTabs
              payload={attemptBody}
              code={`await fetch(\`\${BASE}/v2/advice_session/\${sessionId}/quiz/attempts\`, {\n  method: "POST", headers: auth,\n  body: JSON.stringify({ check_id, investor_id, answers: [{ question_id, selected_option_id }] }),\n}); // → graded { passed, answers[].correct, suitability_value }`}
              endpoint={{ method: "POST", path: "/v2/advice_session/{session_id}/quiz/attempts" }}
            />
            <RunButton
              onRun={async () => {
                await run("POST", "/api/quiz/attempts", attemptBody);
                await load();
              }}
            >
              Submit attempt
            </RunButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
