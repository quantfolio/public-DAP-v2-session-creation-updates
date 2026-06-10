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
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  authed: boolean;
}) {
  const [config, setConfig] = useState<Config>({ expectationOfRisk: EMPTY, riskStrategy: EMPTY });
  const [expectation, setExpectation] = useState("");
  const [strategy, setStrategy] = useState("");
  const [advisorNotes, setAdvisorNotes] = useState("");

  useEffect(() => {
    if (!authed) {
      setConfig({ expectationOfRisk: EMPTY, riskStrategy: EMPTY });
      return;
    }
    fetch("/api/config/risk-question")
      .then((r) => r.json())
      .then((c) =>
        setConfig({
          expectationOfRisk: c.expectationOfRisk ?? EMPTY,
          riskStrategy: c.riskStrategy ?? EMPTY,
        }),
      )
      .catch(() => setConfig({ expectationOfRisk: EMPTY, riskStrategy: EMPTY }));
  }, [authed]);

  const body = {
    advisor_notes: advisorNotes || null,
    expectation_of_risk: !config.expectationOfRisk.enabled || expectation === "" ? null : Number(expectation),
    risk_strategy: !config.riskStrategy.enabled || strategy === "" ? null : Number(strategy),
  };

  async function load() {
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

        <div className="space-y-1.5">
          <Label htmlFor="rq-notes">Advisor notes</Label>
          <Input id="rq-notes" value={advisorNotes} onChange={(e) => setAdvisorNotes(e.target.value)} />
        </div>

        <JsonPreview value={body} />
        <RunButton onRun={() => run("PUT", "/api/risk-question", body)}>Submit</RunButton>
      </CardContent>
    </Card>
  );
}
