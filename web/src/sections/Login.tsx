import { useEffect, useState } from "react";
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

interface AuthStatus {
  authenticated: boolean;
  uri: string | null;
  clientId: string | null;
}

export function Login({ onAuthChange }: { onAuthChange: (authed: boolean) => void }) {
  const [uri, setUri] = useState("https://api.test.deepalpha.dev");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  function apply(s: AuthStatus) {
    setStatus(s);
    onAuthChange(s.authenticated);
  }

  async function refresh() {
    apply(await fetch("/api/auth/status").then((r) => r.json()));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authenticate() {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dap_uri: uri, client_id: clientId, client_secret: clientSecret }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Authentication failed");
      apply({ authenticated: false, uri: null, clientId: null });
      return;
    }
    apply(body);
  }

  async function logout() {
    apply(await fetch("/api/auth/logout", { method: "POST" }).then((r) => r.json()));
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication</CardTitle>
        <CardDescription>OAuth2 client credentials (overrides any .env default).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.authenticated ? (
          <div className="flex items-center justify-between rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">
            <span>
              Authenticated · {status.uri} · client {status.clientId}
            </span>
            <RunButton size="sm" variant="outline" onRun={logout}>
              Log out
            </RunButton>
          </div>
        ) : (
          <div className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800">
            Not authenticated.
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="uri">DAP URI</Label>
          <Input id="uri" value={uri} onChange={(e) => setUri(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cid">Client ID</Label>
            <Input
              id="cid"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="client id"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="csec">Client Secret</Label>
            <Input
              id="csec"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="client secret"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <RunButton onRun={authenticate} disabled={!clientId || !clientSecret}>
          Authenticate
        </RunButton>
      </CardContent>
    </Card>
  );
}
