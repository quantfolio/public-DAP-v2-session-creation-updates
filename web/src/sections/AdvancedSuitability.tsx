import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SourceInfo } from "@/components/SourceInfo";

interface Column {
  id: number;
  label: string;
  description: string | null;
}
interface Table {
  key: string;
  header: string;
  columns: Column[];
}
interface QuizOption {
  id: string;
  label: string;
  correct: boolean;
}
interface QuizQuestion {
  id: string;
  label: string;
  options: QuizOption[];
}
interface QuizCategory {
  id: string;
  numberOfQuestionsToAsk: number;
  questions: QuizQuestion[];
}
interface Quiz {
  enabled: boolean;
  maxAttempts: number;
  attemptResetDays: number;
  wholeQuizRequired: boolean;
  requiredChecks: string[];
  checks: { id: string; categories: QuizCategory[] }[];
}
interface Config {
  enabled: boolean;
  checks: { id: string; label: string }[];
  tables: Table[];
  quiz: Quiz | null;
}

const EMPTY: Config = { enabled: false, checks: [], tables: [], quiz: null };

// Advanced suitability matrices + knowledge quiz — both settings-driven. The
// results persist via the v2 endpoint under construction; for now this renders
// the config and builds the `suitability` payload shape.
export function AdvancedSuitability({ authed, lang }: { authed: boolean; lang: string }) {
  const [config, setConfig] = useState<Config>(EMPTY);
  // suitability[tableKey][checkId] = selected column id
  const [suitability, setSuitability] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!authed) {
      setConfig(EMPTY);
      return;
    }
    fetch(`/api/config/advanced-suitability?lang=${lang}`)
      .then((r) => r.json())
      .then((c: Config) => setConfig(c?.tables ? c : EMPTY))
      .catch(() => setConfig(EMPTY));
  }, [authed, lang]);

  const setCell = (tableKey: string, checkId: string, colId: number) =>
    setSuitability((p) => ({ ...p, [tableKey]: { ...p[tableKey], [checkId]: colId } }));

  const payload = { suitability };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced suitability &amp; quiz</CardTitle>
        <CardDescription>Knowledge/experience matrices + assessment quiz (settings-driven).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            {
              label: "Config",
              value: "settings → roboAdviceForm.knowledgeAndExperience.advancedSuitability.*",
            },
            { label: "Rows", value: "advancedSuitability.checksTranslations" },
            { label: "Quiz", value: "advancedSuitability.knowledgeAssessmentQuiz" },
          ]}
          drift="Not part of the v2 knowledge_and_experience endpoint — persisted via the advisorInput/v2 store endpoint (in progress)."
        />

        {!config.enabled && (
          <p className="text-sm text-muted-foreground">
            Advanced suitability is disabled for this tenant, or not loaded yet (authenticate first).
          </p>
        )}

        {/* Matrices */}
        {config.tables.map((t) => (
          <div key={t.key} className="space-y-1.5">
            <p className="text-sm font-semibold">
              {t.header || t.key} <span className="text-muted-foreground">({t.key})</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-1.5 text-left font-medium text-muted-foreground" />
                    {t.columns.map((c) => (
                      <th key={c.id} className="p-1.5 text-center font-medium" title={c.description ?? undefined}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {config.checks.map((check, i) => (
                    <tr key={check.id} className={i % 2 ? "bg-muted/40" : ""}>
                      <td className="p-1.5">{check.label}</td>
                      {t.columns.map((c) => (
                        <td key={c.id} className="p-1.5 text-center">
                          <input
                            type="radio"
                            name={`${t.key}-${check.id}`}
                            checked={suitability[t.key]?.[check.id] === c.id}
                            onChange={() => setCell(t.key, check.id, c.id)}
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

        {/* Quiz config (read-only preview) */}
        {config.quiz?.enabled && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Knowledge assessment quiz
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                maxAttempts {config.quiz.maxAttempts} · reset {config.quiz.attemptResetDays}d ·{" "}
                {config.quiz.wholeQuizRequired ? "whole quiz required" : "per-check"} · required:{" "}
                {config.quiz.requiredChecks.join(", ") || "—"}
              </span>
            </p>
            {config.quiz.checks.map((check) => {
              const total = check.categories.reduce((n, c) => n + c.numberOfQuestionsToAsk, 0);
              return (
                <details key={check.id} className="rounded-md border text-xs">
                  <summary className="cursor-pointer list-none px-2 py-1.5">
                    <span className="font-medium">{check.id}</span>{" "}
                    <span className="text-muted-foreground">
                      — {check.categories.length} categor{check.categories.length === 1 ? "y" : "ies"}, asks {total} question(s)
                    </span>
                    {config.quiz?.requiredChecks.includes(check.id) && (
                      <span className="ml-1 text-red-600">*</span>
                    )}
                  </summary>
                  <div className="space-y-2 border-t p-2">
                    {check.categories.map((cat) => (
                      <div key={cat.id}>
                        <p className="text-muted-foreground">
                          {cat.id} — asks {cat.numberOfQuestionsToAsk} of {cat.questions.length}
                        </p>
                        <ul className="ml-3 list-disc space-y-1">
                          {cat.questions.map((q) => (
                            <li key={q.id}>
                              {q.label}
                              <span className="text-muted-foreground">
                                {" "}
                                — {q.options.find((o) => o.correct)?.label ?? "?"} ✓
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {/* Payload preview (matrices). Quiz results + persistence land via the v2 endpoint. */}
        {config.enabled && (
          <details className="text-xs">
            <summary className="cursor-pointer select-none text-muted-foreground">Payload (suitability)</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted p-2">
              {JSON.stringify(payload, null, 2)}
            </pre>
            <p className="mt-1 text-muted-foreground">
              Persistence + quiz results (knowledgeAssessmentQuiz[investorId][checkId]) go through the v2
              store endpoint under construction.
            </p>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
