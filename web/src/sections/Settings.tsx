import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { RunButton } from "@/components/ui/run-button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SourceInfo } from "@/components/SourceInfo";
import type { ApiResult } from "@/lib/api";

interface SettingItem {
  name: string;
  value: unknown;
}

export function Settings({
  run,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
}) {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState("");

  const filtered = items.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()));

  async function load() {
    const r = await run("GET", "/api/settings");
    setItems((r.body as { settings?: SettingItem[] } | null)?.settings ?? []);
  }

  function copyKey(name: string) {
    navigator.clipboard.writeText(name);
    setCopied(name);
    setTimeout(() => setCopied(""), 1000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>The tenant's full configuration (drives the forms above).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SourceInfo
          items={[
            { label: "Endpoint", value: "GET /v2/settings/deepalpha" },
            { label: "Shape", value: "{ settings: [{ name, value, ... }] }" },
          ]}
        />
        <div className="flex items-center gap-2">
          <RunButton variant="secondary" onRun={load}>
            Load settings
          </RunButton>
          {items.length > 0 && (
            <Input
              placeholder={`filter ${items.length} keys (e.g. roboAdviceForm.)`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1"
            />
          )}
        </div>

        {items.length > 0 && (
          <div className="max-h-96 divide-y overflow-auto rounded-md border">
            {filtered.map((s) => (
              <details key={s.name} className="text-xs">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 hover:bg-accent">
                  <code className="flex-1 truncate">{s.name}</code>
                  <button
                    type="button"
                    title="Copy key"
                    onClick={(e) => {
                      e.preventDefault();
                      copyKey(s.name);
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    {copied === s.name ? <Check className="size-3" /> : <Copy className="size-3" />}
                  </button>
                </summary>
                <pre className="max-h-60 overflow-auto bg-muted p-2">
                  {JSON.stringify(s.value, null, 2)}
                </pre>
              </details>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-muted-foreground">No keys match “{filter}”.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
