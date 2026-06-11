import { useEffect, useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Input } from "@/components/ui/input";
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
import { createInvestorCode, createSessionCode } from "@/lib/codegen";
import type { ApiResult } from "@/lib/api";

interface ClientInfoField {
  code: string;
  label: string;
  componentType: string;
  required: boolean;
  options: { value: string; label: string }[];
  dateFormat?: string;
}

// Convert an <input type="date"> ISO value (yyyy-mm-dd) to the format the API
// expects (e.g. "MM.dd.yyyy"), as defined per field in the settings.
function formatDate(iso: string, fmt: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return fmt.replace(/yyyy/g, y).replace(/MM/g, mo).replace(/dd/g, d);
}

// Create an investor and an advice session — the start of an integration.
// These are v1 `state` endpoints (no v2 equivalent).
export function Setup({
  run,
  authed,
  lang,
  onSessionCreated,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  authed: boolean;
  lang: string;
  onSessionCreated: (sessionId: string) => void;
}) {
  const [advisors, setAdvisors] = useState<{ advisor_id: string; name: string }[]>([]);
  const [advisorId, setAdvisorId] = useState("");
  const [investorType, setInvestorType] = useState("person");
  const [countries, setCountries] = useState<string[]>([]);
  const [clientInfo, setClientInfo] = useState<{ person: ClientInfoField[]; company: ClientInfoField[] }>({
    person: [],
    company: [],
  });
  const [values, setValues] = useState<Record<string, string>>({ name: "Jane Doe" });
  const [investorId, setInvestorId] = useState("");
  const [sessionName, setSessionName] = useState("New advice session");
  const [adviceType, setAdviceType] = useState("MiFIID II investment Advice");

  useEffect(() => {
    if (!authed) {
      setCountries([]);
      setClientInfo({ person: [], company: [] });
      return;
    }
    fetch("/api/config/countries")
      .then((r) => r.json())
      .then((c: string[]) => setCountries(Array.isArray(c) ? c : []))
      .catch(() => setCountries([]));
    fetch(`/api/config/client-information?lang=${lang}`)
      .then((r) => r.json())
      .then((c) => setClientInfo(c?.person ? c : { person: [], company: [] }))
      .catch(() => setClientInfo({ person: [], company: [] }));
  }, [authed, lang]);

  const fields = (clientInfo[investorType as "person" | "company"] ?? [])
    .filter((f) => f.code !== "clientType")
    // country + investorType are always required by the API (StateInvestorPayload),
    // even when the settings flag says otherwise.
    .map((f) => (f.code === "country" ? { ...f, required: true } : f));
  const setValue = (code: string, v: string) => setValues((p) => ({ ...p, [code]: v }));

  // Map the dynamic field values into the investor payload (StateInvestorPayload).
  // `additionalData.*` codes go into the additionalData object; the rest are top-level.
  const investorBody = (() => {
    const additionalData: Record<string, unknown> = {};
    const top: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = values[f.code];
      if (raw === undefined || raw === "") continue;
      const val: unknown =
        f.componentType === "buttonSwitch"
          ? raw === "true"
          : f.componentType === "datepicker" && f.dateFormat
            ? formatDate(raw, f.dateFormat)
            : raw;
      if (f.code.startsWith("additionalData."))
        additionalData[f.code.slice("additionalData.".length)] = val;
      else top[f.code] = val;
    }
    return {
      investorType,
      ...top,
      advisorId: advisorId || undefined,
      ...(Object.keys(additionalData).length ? { additionalData } : {}),
    };
  })();

  const missingRequired = fields.some((f) => f.required && !(values[f.code] ?? "").trim());

  const sessionBody = {
    advisor_id: advisorId,
    name: sessionName,
    investor_id: investorId || undefined,
    advice_type: adviceType,
  };

  function renderField(f: ClientInfoField) {
    const value = values[f.code] ?? "";
    if (f.componentType === "dropdown") {
      // The country field's options come from roboAdvice.countries.
      const options =
        f.code === "country"
          ? countries.map((c) => ({ value: c, label: c.toUpperCase() }))
          : f.options;
      return (
        <NativeSelect value={value} onChange={(e) => setValue(f.code, e.target.value)}>
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
    }
    if (f.componentType === "buttonSwitch") {
      return (
        <NativeSelect value={value} onChange={(e) => setValue(f.code, e.target.value)}>
          <option value="">— select —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </NativeSelect>
      );
    }
    return (
      <Input
        type={f.componentType === "datepicker" ? "date" : "text"}
        value={value}
        onChange={(e) => setValue(f.code, e.target.value)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup — investor &amp; session</CardTitle>
        <CardDescription>Create an investor and an advice session to work on (v1 state).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            { label: "Advisors", value: "GET /v1/advisor" },
            { label: "Investor", value: "POST /v1/investor (country + investorType required)" },
            { label: "Fields", value: "settings → roboAdvice.clientInformation.{person,company}" },
            { label: "Countries", value: "settings → roboAdvice.countries.items" },
            { label: "Session", value: "POST /v1/state_session (advisor_id + name required)" },
          ]}
        />

        {/* Advisor */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="adv">Advisor</Label>
            <NativeSelect id="adv" value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}>
              <option value="">{advisors.length ? "— select —" : "load advisors first"}</option>
              {advisors.map((a) => (
                <option key={a.advisor_id} value={a.advisor_id}>
                  {a.name} ({a.advisor_id.slice(0, 8)}…)
                </option>
              ))}
            </NativeSelect>
          </div>
          <RunButton
            variant="secondary"
            onRun={async () => {
              const r = await run("GET", "/api/advisors");
              const list = (r.body as { advisors?: { advisor_id: string; name: string }[] } | null)?.advisors ?? [];
              setAdvisors(list);
              if (!advisorId && list[0]) setAdvisorId(list[0].advisor_id);
            }}
          >
            Load advisors
          </RunButton>
        </div>

        {/* Investor — fields driven by clientInformation settings */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Investor</p>
          <div className="space-y-1.5">
            <Label>Client type</Label>
            <NativeSelect value={investorType} onChange={(e) => setInvestorType(e.target.value)}>
              <option value="person">person</option>
              <option value="company">company</option>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2">
            {fields.map((f) => (
              <div key={f.code} className="space-y-1.5">
                <Label>
                  {f.label}
                  {f.required && <span className="text-red-600"> *</span>}
                </Label>
                {renderField(f)}
              </div>
            ))}
          </div>
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">Authenticate to load investor fields.</p>
          )}
          <PayloadTabs
            payload={investorBody}
            code={createInvestorCode()}
            endpoint={{ method: "POST", path: "/v1/investor" }}
          />
          <RunButton
            disabled={!advisorId || missingRequired}
            onRun={async () => {
              const r = await run("POST", "/api/investors", investorBody);
              const id = (r.body as { id?: string } | null)?.id;
              if (id) setInvestorId(id);
            }}
          >
            Create investor
          </RunButton>
        </div>

        {/* Session */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Advice session</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="session name" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
            <NativeSelect value={adviceType} onChange={(e) => setAdviceType(e.target.value)}>
              <option value="MiFIID II investment Advice">MiFIID II investment Advice</option>
              <option value="Order Execution">Order Execution</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv">Investor ID</Label>
            <Input
              id="inv"
              placeholder="auto-filled after Create investor"
              value={investorId}
              onChange={(e) => setInvestorId(e.target.value)}
            />
          </div>
          <PayloadTabs
            payload={sessionBody}
            code={createSessionCode()}
            endpoint={{ method: "POST", path: "/v1/state_session" }}
          />
          <RunButton
            disabled={!advisorId}
            onRun={async () => {
              const r = await run("POST", "/api/sessions", sessionBody);
              const sid = (r.body as { session_id?: string } | null)?.session_id;
              if (sid) onSessionCreated(sid);
            }}
          >
            Create session &amp; use it
          </RunButton>
        </div>
      </CardContent>
    </Card>
  );
}
