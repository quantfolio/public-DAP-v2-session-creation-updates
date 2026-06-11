import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "https://api.test.deepalpha.dev";

function toCurl(method: string, path: string, payload: unknown): string {
  const url = `${BASE}${path}`;
  const lines = [`curl -X ${method} '${url}' \\`, `  -H 'Authorization: Bearer $TOKEN'`];
  if (payload !== undefined && method !== "GET") {
    lines[lines.length - 1] += " \\";
    lines.push(`  -H 'Content-Type: application/json' \\`, `  -d '${JSON.stringify(payload, null, 2)}'`);
  }
  return lines.join("\n");
}

type Tab = "payload" | "curl" | "code";

// Collapsible panel: request Payload, an equivalent cURL, and a TypeScript example.
export function PayloadTabs({
  payload,
  code,
  endpoint,
}: {
  payload: unknown;
  code: string;
  endpoint: { method: string; path: string };
}) {
  const [tab, setTab] = useState<Tab>("payload");
  const [copied, setCopied] = useState(false);

  const text =
    tab === "payload"
      ? JSON.stringify(payload, null, 2)
      : tab === "curl"
        ? toCurl(endpoint.method, endpoint.path, payload)
        : code;

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const tabBtn = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={cn(
        "rounded px-2 py-1 text-xs font-medium",
        tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <details className="text-xs">
      <summary className="cursor-pointer select-none text-muted-foreground">
        Payload &amp; code example
      </summary>
      <div className="mt-2 overflow-hidden rounded-md border">
        <div className="flex items-center justify-between border-b bg-muted/50 p-1">
          <div className="flex gap-1">
            {tabBtn("payload", "Payload")}
            {tabBtn("curl", "cURL")}
            {tabBtn("code", "TypeScript")}
          </div>
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-96 overflow-auto p-2 text-xs">{text}</pre>
      </div>
    </details>
  );
}
