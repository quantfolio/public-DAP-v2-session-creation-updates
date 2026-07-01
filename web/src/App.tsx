import { useCallback, useEffect, useRef, useState } from "react";
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
import { NativeSelect as Select } from "@/components/ui/native-select";
import { SourceInfo } from "@/components/SourceInfo";
import { JsonModal } from "@/components/JsonModal";
import { DocsModal } from "@/components/DocsModal";
import type { AdvisorNoteFlag } from "@/components/AdvisorNotesField";
import { apiCall, errorMessage, formatRequest, type ApiResult } from "@/lib/api";
import { Login } from "@/sections/Login";
import { Settings } from "@/sections/Settings";
import { Setup } from "@/sections/Setup";
import { Goals } from "@/sections/Goals";
import { AdviceInformation } from "@/sections/AdviceInformation";
import { FinancialSituation } from "@/sections/FinancialSituation";
import { KnowledgeExperience } from "@/sections/KnowledgeExperience";
import { AdvancedSuitability } from "@/sections/AdvancedSuitability";
import { RiskQuestion } from "@/sections/RiskQuestion";
import { Sustainability } from "@/sections/Sustainability";
import { Maximize2 } from "lucide-react";

export function App() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("da_session_id") || "");

  // Persist the active session id across reloads.
  useEffect(() => {
    localStorage.setItem("da_session_id", sessionId);
  }, [sessionId]);
  const [history, setHistory] = useState<(ApiResult & { id: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const idRef = useRef(0);
  const [authed, setAuthed] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [notes, setNotes] = useState<Record<string, AdvisorNoteFlag>>({});
  const [modal, setModal] = useState<ApiResult | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("da_lang") || "en");
  const [langOptions, setLangOptions] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem("da_lang", lang);
  }, [lang]);

  useEffect(() => {
    if (!authed) {
      setNotes({});
      setLangOptions([]);
      return;
    }
    fetch("/api/config/advisor-notes")
      .then((r) => r.json())
      .then((c) => setNotes(c && typeof c === "object" ? c : {}))
      .catch(() => setNotes({}));
    fetch("/api/config/languages")
      .then((r) => r.json())
      .then((l: { options?: string[]; default?: string }) => {
        setLangOptions(Array.isArray(l.options) ? l.options : []);
        if (!localStorage.getItem("da_lang") && l.default) setLang(l.default);
      })
      .catch(() => setLangOptions([]));
  }, [authed]);

  const run = useCallback(
    async (method: string, path: string, body?: unknown) => {
      setLoading(true);
      const r = await apiCall(method, path, sessionId, body);
      setHistory((h) => [{ ...r, id: ++idRef.current }, ...h].slice(0, 50));
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

  // Fetch the CSV (shows the button's spinner while it runs) then download it.
  async function exportCsv() {
    const res = await fetch(`/api/export.csv?session_id=${encodeURIComponent(sessionId)}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "endpoint-mapping.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DeepAlpha POC — Dev Tool</h1>
          <p className="text-sm text-muted-foreground">
            Set a session id and exercise the v2 advice_session endpoints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {langOptions.length > 1 && (
            <Select value={lang} onChange={(e) => setLang(e.target.value)} className="w-auto">
              {langOptions.map((o) => (
                <option key={o} value={o}>
                  {o.toUpperCase()}
                </option>
              ))}
            </Select>
          )}
          {authed && (
            <RunButton
              variant="outline"
              onRun={exportCsv}
              title="Export a flattened field mapping (CSV) for all covered endpoints"
            >
              Export CSV
            </RunButton>
          )}
          <RunButton variant="outline" onRun={() => setDocsOpen(true)}>
            Docs
          </RunButton>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — actions */}
        <div className="space-y-6">
          <Login onAuthChange={setAuthed} />
          <Settings run={run} />

          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>
                The active session — its id is sent as <code>?session_id=</code> on every request
                in every section below.
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
                <Label htmlFor="sid" className="flex items-center gap-2">
                  Active session ID
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                    active
                  </span>
                </Label>
                <Input id="sid" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
                {sessions.find((s) => s.id === sessionId) && (
                  <p className="text-xs text-muted-foreground">
                    {sessions.find((s) => s.id === sessionId)?.name}
                  </p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="spick">Or pick a session (sets the active id above)</Label>
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

          <Setup run={run} authed={authed} lang={lang} onSessionCreated={setSessionId} />
          <Goals run={run} authed={authed} lang={lang} notesFlag={notes.goalInformation} sessionId={sessionId} />
          <KnowledgeExperience run={run} notesFlag={notes.knowledgeAndExperience} />
          <AdvancedSuitability authed={authed} lang={lang} />
          <RiskQuestion run={run} authed={authed} lang={lang} notesFlag={notes.purposeAndRisk} />
          <AdviceInformation run={run} notesFlag={notes.adviceInformation} />
          <Sustainability run={run} authed={authed} lang={lang} notesFlag={notes.sustainabilityPreference} />
          <FinancialSituation run={run} lang={lang} notesFlag={notes.financialSituation} />
        </div>

        {/* Right column — sticky collapsible history */}
        <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              History
              {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              <span className="text-muted-foreground">({history.length})</span>
            </h2>
            {history.length > 0 && (
              <button
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setHistory([])}
              >
                Clear
              </button>
            )}
          </div>

          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          )}

          <div className="space-y-2">
            {history.map((r, i) => {
              const ok = typeof r.status === "number" && r.status < 400;
              return (
                <details key={r.id} open={i === 0} className="rounded-lg border bg-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-2.5">
                    <span className="truncate text-xs">
                      <span className="font-semibold">{r.method}</span> {r.path}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {r.ms !== undefined && (
                        <span className="text-xs tabular-nums text-muted-foreground">{r.ms} ms</span>
                      )}
                      <span
                        role="button"
                        title="Open full screen with search"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setModal(r);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Maximize2 className="size-3.5" />
                      </span>
                      <span
                        className={
                          "rounded px-1.5 py-0.5 text-xs font-medium " +
                          (ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")
                        }
                      >
                        {r.status}
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-2 p-2.5 pt-0">
                    {!ok && errorMessage(r) && (
                      <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
                        {errorMessage(r)}
                      </p>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                        Request{r.upstream ? " (DeepAlpha)" : ""}
                      </p>
                      <pre className="overflow-auto rounded-md bg-muted p-2 text-xs">
                        {formatRequest(r)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                        Response
                      </p>
                      <pre className="max-h-80 overflow-auto rounded-md bg-muted p-2 text-xs">
                        {JSON.stringify(r.body, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>

      {modal && <JsonModal result={modal} onClose={() => setModal(null)} />}
      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}
    </div>
  );
}
