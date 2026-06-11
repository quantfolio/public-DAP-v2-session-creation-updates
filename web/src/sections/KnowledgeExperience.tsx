import { useState } from "react";
import { RunButton } from "@/components/ui/run-button";
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
import { knowledgeExperienceCode } from "@/lib/codegen";
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
  notesFlag,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  notesFlag?: AdvisorNoteFlag;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [advisorNotes, setAdvisorNotes] = useState("");

  async function load() {
    const r = await run("GET", "/api/knowledge-and-experience");
    const body = r.body as {
      data?: { advisor_notes?: string | null; answers?: Record<string, number | number[]> };
      meta?: { questions?: Question[] };
    } | null;
    const qs = body?.meta?.questions ?? [];
    setQuestions(qs);
    setAdvisorNotes(body?.data?.advisor_notes ?? "");
    const ans = body?.data?.answers ?? {};
    const prefilled: Record<string, number> = {};
    for (const q of qs) {
      const v = ans[q.code];
      if (typeof v === "number") prefilled[q.code] = v;
    }
    setAnswers(prefilled);
  }

  const notes = notesFlag?.enabled ? advisorNotes || null : null;

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
            { label: "Options", value: "GET response → meta.questions[].options (live)" },
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

        <AdvisorNotesField flag={notesFlag} value={advisorNotes} onChange={setAdvisorNotes} />
        <PayloadTabs
          payload={{ advisor_notes: notes, answers }}
          code={knowledgeExperienceCode()}
          endpoint={{ method: "PUT", path: "/v2/advice_session/{session_id}/knowledge_and_experience" }}
        />
        <RunButton onRun={() => run("PUT", "/api/knowledge-and-experience", { advisor_notes: notes, answers })}>
          Submit answers
        </RunButton>
      </CardContent>
    </Card>
  );
}
