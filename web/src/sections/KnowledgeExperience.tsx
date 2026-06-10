import { useState } from "react";
import { RunButton } from "@/components/ui/run-button";
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

interface Question {
  code: string;
  label: string | null;
  is_multi_select: boolean;
  value: number | null;
  options: { id: number; label: string }[];
}

export function KnowledgeExperience({
  run,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  async function load() {
    const r = await run("GET", "/api/knowledge-and-experience");
    const qs = (r.body as { data?: { questions?: Question[] } } | null)?.data?.questions ?? [];
    setQuestions(qs);
    const prefilled: Record<string, number> = {};
    for (const q of qs) if (typeof q.value === "number") prefilled[q.code] = q.value;
    setAnswers(prefilled);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge &amp; experience</CardTitle>
        <CardDescription>GET / PUT /knowledge-and-experience · options from the live questions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SourceInfo
          items={[
            {
              label: "Endpoint",
              value: "GET·PUT /v2/advice_session/{session_id}/knowledge_and_experience",
            },
            { label: "Options", value: "GET response → data.questions[].options (live)" },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load questions
        </RunButton>

        {questions.map((q) => (
          <div key={q.code} className="space-y-1.5">
            <Label>{q.label ?? q.code}</Label>
            <Select
              value={answers[q.code] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.code]: Number(e.target.value) }))
              }
            >
              <option value="">— select —</option>
              {q.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        ))}

        {questions.length > 0 && (
          <>
            <JsonPreview value={{ answers }} />
            <RunButton onRun={() => run("PUT", "/api/knowledge-and-experience", { answers })}>
              Submit answers
            </RunButton>
          </>
        )}
      </CardContent>
    </Card>
  );
}
