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

interface GoalType {
  type: string;
  label: string;
  iconName: string;
  iconUrl: string;
}
interface GoalInfoField {
  code: string;
  label: string;
  componentType: string;
  goalTypes: string[];
  options: { value: string; label: string }[];
}

export function Goals({
  run,
  authed,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
  authed: boolean;
}) {
  const [name, setName] = useState("New goal");
  const [horizon, setHorizon] = useState("10");
  const [goalType, setGoalType] = useState("growYourWealth");
  const [icon, setIcon] = useState("");
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [goalId, setGoalId] = useState("");
  const [advisorNotes, setAdvisorNotes] = useState("");
  const [infoFields, setInfoFields] = useState<GoalInfoField[]>([]);
  const [infoValues, setInfoValues] = useState<Record<string, string>>({});
  const [infoGoalType, setInfoGoalType] = useState<string>("");

  useEffect(() => {
    if (!authed) {
      setGoalTypes([]);
      setInfoFields([]);
      return;
    }
    fetch("/api/config/goal-types")
      .then((r) => r.json())
      .then((types: GoalType[]) => {
        const list = Array.isArray(types) ? types : [];
        setGoalTypes(list);
        const current = list.find((t) => t.type === goalType);
        if (current) setIcon(current.iconUrl);
      })
      .catch(() => setGoalTypes([]));
    fetch("/api/config/goal-information")
      .then((r) => r.json())
      .then((f) => setInfoFields(Array.isArray(f) ? f : []))
      .catch(() => setInfoFields([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  function selectGoalType(type: string) {
    setGoalType(type);
    const t = goalTypes.find((g) => g.type === type);
    if (t) setIcon(t.iconUrl);
  }

  const createBody = { name, horizon_value: Number(horizon), type: goalType, icon };

  // Goal-information fields are scoped to the goal's type — only show applicable ones.
  const visibleInfoFields = infoGoalType
    ? infoFields.filter((f) => f.goalTypes.length === 0 || f.goalTypes.includes(infoGoalType))
    : infoFields;
  const infoBody = Object.fromEntries(
    visibleInfoFields.map((f) => [f.code, infoValues[f.code] ?? ""]).filter(([, v]) => v !== ""),
  );

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
              <Label htmlFor="ghor">Horizon (years)</Label>
              <Input
                id="ghor"
                type="number"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
              />
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
              <div className="flex items-center gap-2">
                {icon && (
                  <img
                    src={icon}
                    alt="goal icon"
                    className="size-9 shrink-0 rounded border bg-white object-contain p-1"
                    onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                  />
                )}
                <Input id="gicon" value={icon} onChange={(e) => setIcon(e.target.value)} />
              </div>
            </div>
          </div>
          <JsonPreview value={createBody} />
          <RunButton
            onRun={async () => {
              const r = await run("POST", "/api/goals", createBody);
              const id = (r.body as { id?: string } | null)?.id;
              if (id) {
                setGoalId(id);
                setInfoGoalType(goalType);
              }
            }}
          >
            Create goal
          </RunButton>
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
          <div className="space-y-1.5">
            <Label htmlFor="gitype">Goal type (scopes the fields below)</Label>
            <Select id="gitype" value={infoGoalType} onChange={(e) => setInfoGoalType(e.target.value)}>
              <option value="">— all types —</option>
              {goalTypes.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label} ({t.type})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gnotes">Advisor notes</Label>
            <Input
              id="gnotes"
              value={advisorNotes}
              onChange={(e) => setAdvisorNotes(e.target.value)}
            />
          </div>

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

          {goalId && <JsonPreview value={{ advisor_notes: advisorNotes || null, fields: infoBody }} />}

          <div className="flex gap-2">
            <RunButton
              variant="secondary"
              disabled={!goalId}
              onRun={async () => {
                const r = await run("GET", `/api/goals/${goalId}/information`);
                const data = (r.body as { data?: { advisor_notes?: string | null; fields?: Record<string, unknown> } } | null)?.data;
                setAdvisorNotes(data?.advisor_notes ?? "");
                const vals: Record<string, string> = {};
                for (const [k, v] of Object.entries(data?.fields ?? {})) if (v != null) vals[k] = String(v);
                setInfoValues(vals);
              }}
            >
              Get
            </RunButton>
            <RunButton
              disabled={!goalId}
              onRun={() =>
                run("PATCH", `/api/goals/${goalId}/information`, {
                  advisor_notes: advisorNotes || null,
                  fields: infoBody,
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
