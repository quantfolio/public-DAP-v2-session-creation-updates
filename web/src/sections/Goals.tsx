import { useEffect, useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect as Select } from "@/components/ui/native-select";
import {
  Select as IconSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
import { createGoalCode, goalInformationCode } from "@/lib/codegen";
import { apiCall, type ApiResult } from "@/lib/api";

interface GoalType {
  type: string;
  label: string;
  iconName: string;
  iconUrl: string;
}
interface GoalInfoOption {
  value: string;
  label: string;
  conditionalFields: GoalInfoField[];
}
interface GoalInfoField {
  code: string;
  label: string;
  componentType: string;
  goalTypes: string[];
  options: GoalInfoOption[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Flatten fields in render order, including each selected option's conditional fields.
function visibleGoalInfoFields(
  fields: GoalInfoField[],
  values: Record<string, string>,
): GoalInfoField[] {
  const out: GoalInfoField[] = [];
  for (const f of fields) {
    out.push(f);
    const selected = f.options.find((o) => o.value === (values[f.code] ?? ""));
    if (selected) out.push(...visibleGoalInfoFields(selected.conditionalFields, values));
  }
  return out;
}

export function Goals({
  run,
  authed,
  lang,
  notesFlag,
  sessionId,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  authed: boolean;
  lang: string;
  notesFlag?: AdvisorNoteFlag;
  sessionId: string;
}) {
  const [name, setName] = useState("New goal");
  const [horizon, setHorizon] = useState("1");
  const [horizonOptions, setHorizonOptions] = useState<{ value: number; label: string }[]>([]);
  const [goalType, setGoalType] = useState("growYourWealth");
  const [icon, setIcon] = useState("");
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [goalId, setGoalId] = useState("");
  const [advisorNotes, setAdvisorNotes] = useState("");
  const [infoFields, setInfoFields] = useState<GoalInfoField[]>([]);
  const [infoValues, setInfoValues] = useState<Record<string, string>>({});
  // The goal's type — fetched from the goal GET — scopes which info fields apply.
  const [infoGoalType, setInfoGoalType] = useState("");

  useEffect(() => {
    if (!authed) {
      setGoalTypes([]);
      setInfoFields([]);
      return;
    }
    fetch(`/api/config/goal-types?lang=${lang}`)
      .then((r) => r.json())
      .then((types: GoalType[]) => {
        const list = Array.isArray(types) ? types : [];
        setGoalTypes(list);
        const current = list.find((t) => t.type === goalType);
        if (current) setIcon(current.iconUrl);
      })
      .catch(() => setGoalTypes([]));
    fetch(`/api/config/goal-information?lang=${lang}`)
      .then((r) => r.json())
      .then((f) => setInfoFields(Array.isArray(f) ? f : []))
      .catch(() => setInfoFields([]));
    fetch(`/api/config/goal-horizons?lang=${lang}`)
      .then((r) => r.json())
      .then((h) => setHorizonOptions(Array.isArray(h) ? h : []))
      .catch(() => setHorizonOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, lang]);

  function selectGoalType(type: string) {
    setGoalType(type);
    const t = goalTypes.find((g) => g.type === type);
    if (t) setIcon(t.iconUrl);
  }

  const validGoalId = UUID_RE.test(goalId);

  // Resolve the goal's type from the goal GET so we can scope the info fields.
  useEffect(() => {
    if (!authed || !validGoalId) {
      setInfoGoalType("");
      return;
    }
    let cancelled = false;
    apiCall("GET", `/api/goals/${goalId}`, sessionId).then((r) => {
      if (cancelled) return;
      const t = (r.body as { data?: { type?: string } } | null)?.data?.type;
      setInfoGoalType(typeof t === "string" ? t : "");
    });
    return () => {
      cancelled = true;
    };
  }, [goalId, authed, validGoalId, sessionId]);

  const createBody = { name, horizon_value: Number(horizon), type: goalType, icon };
  const iconOptions = goalTypes.filter((t) => t.iconUrl).map((t) => ({ url: t.iconUrl, name: t.iconName }));

  // Goal-information fields are scoped to the resolved goal type, then expanded
  // with any conditional sub-fields based on the current selections.
  const topInfoFields = infoGoalType
    ? infoFields.filter((f) => f.goalTypes.length === 0 || f.goalTypes.includes(infoGoalType))
    : infoFields;
  const visibleInfoFields = visibleGoalInfoFields(topInfoFields, infoValues);
  const infoBody = Object.fromEntries(
    visibleInfoFields.map((f) => [f.code, infoValues[f.code] ?? ""]).filter(([, v]) => v !== ""),
  );
  const goalNotes = notesFlag?.enabled ? advisorNotes || null : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create goal</CardTitle>
          <CardDescription>POST /goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SourceInfo
            items={[
              { label: "Endpoint", value: "POST /v2/advice_session/{session_id}/goal" },
              { label: "Goal types", value: "settings → roboAdviceForm.purposeAndRisk.goals.goal{N}.type" },
              { label: "Icon", value: "settings → roboAdviceForm.purposeAndRisk.goals.goal{N}.iconUrl" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gname">Name</Label>
              <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ghor">Horizon</Label>
              <Select id="ghor" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                {horizonOptions.length === 0 && <option value="1">0 to 4 years</option>}
                {horizonOptions.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label} ({h.value})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gtype">Goal type</Label>
              <Select id="gtype" value={goalType} onChange={(e) => selectGoalType(e.target.value)}>
                {goalTypes.length === 0 && <option value="growYourWealth">Grow your wealth</option>}
                {goalTypes.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label} ({t.type})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gicon">Icon</Label>
              <IconSelect value={icon} onValueChange={setIcon}>
                <SelectTrigger id="gicon">
                  <SelectValue placeholder="Select an icon" />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((o) => (
                    <SelectItem key={o.url} value={o.url}>
                      <span className="flex items-center gap-2">
                        <img src={o.url} alt="" className="size-4 object-contain" />
                        {o.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </IconSelect>
            </div>
          </div>
          <PayloadTabs
            payload={createBody}
            code={createGoalCode()}
            endpoint={{ method: "POST", path: "/v2/advice_session/{session_id}/goal" }}
          />
          <div className="flex gap-2">
            <RunButton
              onRun={async () => {
                const r = await run("POST", "/api/goals", createBody);
                const id = (r.body as { id?: string } | null)?.id;
                if (id) {
                  setGoalId(id);
                }
              }}
            >
              Create goal
            </RunButton>
            <RunButton variant="secondary" onRun={() => run("GET", "/api/goals")}>
              List goals
            </RunButton>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Goal information</CardTitle>
          <CardDescription>GET / PATCH /goals/:goalId/information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SourceInfo
            items={[
              {
                label: "Endpoint",
                value: "GET·PATCH /v2/advice_session/{session_id}/goal/{goal_id}/information",
              },
              { label: "Fields", value: "settings → roboAdviceForm.goalInformation.fields" },
            ]}
          />
          <div className="space-y-1.5">
            <Label htmlFor="gid">Goal ID</Label>
            <Input
              id="gid"
              placeholder="auto-filled after Create goal"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
            />
          </div>
          {goalId && !validGoalId && (
            <p className="text-xs text-red-600">Goal ID must be a valid UUID.</p>
          )}
          {validGoalId && infoGoalType && (
            <p className="text-xs text-muted-foreground">
              Goal type: <code>{infoGoalType}</code> — {visibleInfoFields.length} applicable field(s).
            </p>
          )}
          <AdvisorNotesField flag={notesFlag} value={advisorNotes} onChange={setAdvisorNotes} />

          {visibleInfoFields.map((f) => (
            <div key={f.code} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Select
                value={infoValues[f.code] ?? ""}
                onChange={(e) => setInfoValues((p) => ({ ...p, [f.code]: e.target.value }))}
              >
                <option value="">— select —</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}

          <PayloadTabs
            payload={{ advisor_notes: goalNotes, answers: infoBody }}
            code={goalInformationCode()}
            endpoint={{ method: "PATCH", path: "/v2/advice_session/{session_id}/goal/{goal_id}/information" }}
          />

          <div className="flex gap-2">
            <RunButton
              variant="secondary"
              disabled={!validGoalId}
              onRun={() => run("GET", `/api/goals/${goalId}`)}
            >
              Get goal
            </RunButton>
            <RunButton
              variant="secondary"
              disabled={!validGoalId}
              onRun={async () => {
                const r = await run("GET", `/api/goals/${goalId}/information`);
                const data = (r.body as { data?: { advisor_notes?: string | null; answers?: Record<string, unknown> } } | null)?.data;
                setAdvisorNotes(data?.advisor_notes ?? "");
                const vals: Record<string, string> = {};
                for (const [k, v] of Object.entries(data?.answers ?? {})) if (v != null) vals[k] = String(v);
                setInfoValues(vals);
              }}
            >
              Get info
            </RunButton>
            <RunButton
              disabled={!validGoalId}
              onRun={() =>
                run("PATCH", `/api/goals/${goalId}/information`, {
                  advisor_notes: goalNotes,
                  answers: infoBody,
                })
              }
            >
              Patch
            </RunButton>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
