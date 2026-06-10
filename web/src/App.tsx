import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RunButton } from "@/components/ui/run-button";
import { Select } from "@/components/ui/select";
import { SourceInfo } from "@/components/SourceInfo";
import { apiCall, type ApiResult } from "@/lib/api";
import { Login } from "@/sections/Login";
import { Goals } from "@/sections/Goals";
import { AdviceInformation } from "@/sections/AdviceInformation";
import { FinancialSituation } from "@/sections/FinancialSituation";
import { KnowledgeExperience } from "@/sections/KnowledgeExperience";
import { RiskQuestion } from "@/sections/RiskQuestion";
import { Sustainability } from "@/sections/Sustainability";

const DEFAULT_SESSION_ID = "986514b1-1134-435f-a6be-aaab27ea4f6d";

export function App() {
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);

  const run = useCallback(
    async (method: string, path: string, body?: unknown) => {
      setLoading(true);
      const r = await apiCall(method, path, sessionId, body);
      setResult(r);
      setLoading(false);
      return r;
    },
    [sessionId],
  );

  async function loadSessions() {
    const r = await run("GET", "/api/advice-sessions?size=50");
    const arr = (r.body as { data?: { id: string; name: string }[] } | null)?.data ?? [];
    setSessions(arr.map((s) => ({ id: s.id, name: s.name })));
  }

  const ok = typeof result?.status === "number" && result.status < 400;

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">DeepAlpha POC — Dev Tool</h1>
        <p className="text-sm text-muted-foreground">
          Set a session id and exercise the v2 advice_session endpoints.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — actions */}
        <div className="space-y-6">
          <Login onAuthChange={setAuthed} />

          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>
                v2 advice_session · sent as <code>?session_id=</code> on every request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SourceInfo
                items={[
                  { label: "List", value: "GET /v2/advice_session" },
                  { label: "Get", value: "GET /v2/advice_session/{session_id}" },
                ]}
              />
              <div className="space-y-1.5">
                <Label htmlFor="sid">Session ID</Label>
                <Input id="sid" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="spick">Or pick a session</Label>
                  <Select
                    id="spick"
                    value={sessions.some((s) => s.id === sessionId) ? sessionId : ""}
                    onChange={(e) => e.target.value && setSessionId(e.target.value)}
                    disabled={sessions.length === 0}
                  >
                    <option value="">{sessions.length ? "— select —" : "load sessions first"}</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id.slice(0, 8)}…)
                      </option>
                    ))}
                  </Select>
                </div>
                <RunButton variant="secondary" onRun={loadSessions}>
                  Load sessions
                </RunButton>
              </div>
              <div className="flex flex-wrap gap-2">
                <RunButton variant="secondary" onRun={() => run("GET", `/api/advice-sessions/${sessionId}`)}>
                  Get this session
                </RunButton>
                <RunButton variant="ghost" onRun={() => run("GET", "/api/health")}>
                  Health
                </RunButton>
              </div>
            </CardContent>
          </Card>

          <Goals run={run} authed={authed} />
          <KnowledgeExperience run={run} />
          <RiskQuestion run={run} authed={authed} />
          <AdviceInformation run={run} />
          <Sustainability run={run} authed={authed} />
          <FinancialSituation run={run} />
        </div>

        {/* Right column — sticky request/response */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Request / Response
                {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              {result && (
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " +
                    (ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")
                  }
                >
                  {result.status}
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {!result && !loading && (
                <p className="text-sm text-muted-foreground">No request yet.</p>
              )}

              {result && (
                <>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Request
                    </p>
                    <p className="break-all rounded-md bg-muted p-2 text-xs">
                      <span className="font-semibold">{result.method}</span> {result.url}
                    </p>
                    {result.requestBody !== undefined && (
                      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                        {JSON.stringify(result.requestBody, null, 2)}
                      </pre>
                    )}
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Response
                    </p>
                    <pre className="max-h-[calc(100vh-22rem)] overflow-auto rounded-md bg-muted p-2 text-xs">
                      {loading ? "Loading…" : JSON.stringify(result.body, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
