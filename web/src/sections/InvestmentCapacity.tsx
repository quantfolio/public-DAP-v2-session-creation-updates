import { useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function InvestmentCapacity({
  run,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
}) {
  const [fields, setFields] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  async function load() {
    const r = await run("GET", "/api/investment-capacity");
    const body = r.body as {
      data?: { investment_capacity?: Record<string, number | null> | null };
      meta?: { input_fields?: string[] };
    } | null;
    setFields(body?.meta?.input_fields ?? []);
    const ic = body?.data?.investment_capacity ?? {};
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(ic)) if (v != null) next[k] = String(v);
    setValues(next);
  }

  // Only send filled numbers (PATCH merges).
  const investment_capacity = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [k, Number(v)]),
  );
  const body = { investment_capacity };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment capacity</CardTitle>
        <CardDescription>GET / PATCH /investment_capacity · income, expenses, buffer…</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            { label: "Endpoint", value: "GET·PATCH /v2/advice_session/{session_id}/investment_capacity" },
            { label: "Fields", value: "GET response → meta.input_fields" },
            { label: "Body", value: "{ investment_capacity: { [field]: number } } (merged)" },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load
        </RunButton>

        {fields.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f} className="space-y-1.5">
                  <Label htmlFor={`ic-${f}`}>{f}</Label>
                  <Input
                    id={`ic-${f}`}
                    type="number"
                    value={values[f] ?? ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <PayloadTabs
              payload={body}
              code={`await fetch(\`\${BASE}/v2/advice_session/\${sessionId}/investment_capacity\`, {\n  method: "PATCH", headers: auth,\n  body: JSON.stringify({ investment_capacity: { income: 1235123, buffer: 2470246 } }),\n});`}
              endpoint={{ method: "PATCH", path: "/v2/advice_session/{session_id}/investment_capacity" }}
            />
            <RunButton onRun={() => run("PATCH", "/api/investment-capacity", body)}>Save</RunButton>
          </>
        )}
      </CardContent>
    </Card>
  );
}
