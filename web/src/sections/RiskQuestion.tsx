import { useEffect, useState } from "react";
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
import { SourceInfo } from "@/components/SourceInfo";
import { PayloadTabs } from "@/components/PayloadTabs";
import { AdvisorNotesField, type AdvisorNoteFlag } from "@/components/AdvisorNotesField";
import { riskQuestionCode } from "@/lib/codegen";
import type { ApiResult } from "@/lib/api";

interface RiskOption {
  id: number;
  label: string;
}
interface RiskQ {
  enabled: boolean;
  options: RiskOption[];
}
interface Config {
  expectationOfRisk: RiskQ;
  riskStrategy: RiskQ;
}

const EMPTY: RiskQ = { enabled: false, options: [] };

export function RiskQuestion({
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
  const [config, setConfig] = useState<Config>({ expectationOfRisk: EMPTY, riskStrategy: EMPTY });
  const [expectation, setExpectation] = useState("");
  const [strategy, setStrategy] = useState("");
  const [advisorNotes, setAdvisorNotes] = useState("");

  async function loadConfig() {
    try {
      const c = await fetch(`/api/config/risk-question?lang=${lang}`).then((r) => r.json());
      setConfig({
        expectationOfRisk: c.expectationOfRisk ?? EMPTY,
        riskStrategy: c.riskStrategy ?? EMPTY,
      });
    } catch {
      setConfig({ expectationOfRisk: EMPTY, riskStrategy: EMPTY });
    }
  }

  useEffect(() => {
    if (!authed) {
      setConfig({ expectationOfRisk: EMPTY, riskStrategy: EMPTY });
      return;
    }
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, lang]);

  const body = {
    advisor_notes: notesFlag?.enabled ? advisorNotes || null : null,
    expectation_of_risk: !config.expectationOfRisk.enabled || expectation === "" ? null : Number(expectation),
    risk_strategy: !config.riskStrategy.enabled || strategy === "" ? null : Number(strategy),
  };

  async function load() {
    await loadConfig(); // ensure options/enabled are loaded alongside the values
    const r = await run("GET", "/api/risk-question");
    const data = (r.body as { data?: { expectation_of_risk?: number | null; risk_strategy?: number | null; advisor_notes?: string | null } } | null)?.data;
    setExpectation(data?.expectation_of_risk != null ? String(data.expectation_of_risk) : "");
    setStrategy(data?.risk_strategy != null ? String(data.risk_strategy) : "");
    setAdvisorNotes(data?.advisor_notes ?? "");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk question</CardTitle>
        <CardDescription>GET / PUT /risk-question · options from settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SourceInfo
          items={[
            { label: "Endpoint", value: "GET·PUT /v2/advice_session/{session_id}/risk_question" },
            { label: "Expectation", value: "settings → roboAdviceForm.purposeAndRisk.expectationOfRisk" },
            { label: "Strategy", value: "settings → roboAdviceForm.purposeAndRisk.riskStrategy" },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load current
        </RunButton>

        {config.expectationOfRisk.enabled && (
          <div className="space-y-1.5">
            <Label>Expectation of risk</Label>
            <Select value={expectation} onChange={(e) => setExpectation(e.target.value)}>
              <option value="">— select —</option>
              {config.expectationOfRisk.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.id})
                </option>
              ))}
            </Select>
          </div>
        )}

        {config.riskStrategy.enabled ? (
          <div className="space-y-1.5">
            <Label>Risk strategy</Label>
            <Select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <option value="">— select —</option>
              {config.riskStrategy.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.id})
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Risk strategy is disabled for this tenant (isRisk2Hidden).</p>
        )}

        <AdvisorNotesField flag={notesFlag} value={advisorNotes} onChange={setAdvisorNotes} />

        <PayloadTabs
          payload={body}
          code={riskQuestionCode()}
          endpoint={{ method: "PUT", path: "/v2/advice_session/{session_id}/risk_question" }}
        />
        <RunButton onRun={() => run("PUT", "/api/risk-question", body)}>Submit</RunButton>
      </CardContent>
    </Card>
  );
}
