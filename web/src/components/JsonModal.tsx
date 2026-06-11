import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatRequest, type ApiResult } from "@/lib/api";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Full-width modal showing a request/response with search, match navigation, and highlighting.
export function JsonModal({ result, onClose }: { result: ApiResult; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const markRefs = useRef<(HTMLElement | null)[]>([]);

  const text = useMemo(() => {
    return [
      `// Request${result.upstream ? " (DeepAlpha)" : ""}`,
      formatRequest(result),
      "",
      `// Response (status ${result.status})`,
      JSON.stringify(result.body, null, 2),
    ].join("\n");
  }, [result]);

  const { nodes, count } = useMemo(() => {
    if (!query) return { nodes: text as ReactNode, count: 0 };
    markRefs.current = [];
    const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
    let n = 0;
    const rendered = parts.map((part, i) => {
      if (part.toLowerCase() !== query.toLowerCase()) return part;
      const idx = n++;
      return (
        <mark
          key={i}
          ref={(el) => {
            markRefs.current[idx] = el;
          }}
          className={
            idx === active ? "rounded bg-orange-400 text-black" : "bg-yellow-300 text-black"
          }
        >
          {part}
        </mark>
      );
    });
    return { nodes: rendered as ReactNode, count: n };
  }, [text, query, active]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Reset to the first match whenever the query changes.
  useEffect(() => setActive(0), [query]);

  // Scroll the active match into view.
  useEffect(() => {
    markRefs.current[active]?.scrollIntoView({ block: "center" });
  }, [active, query, count]);

  const go = (delta: number) => setActive((a) => (count ? (a + delta + count) % count : 0));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-[95vw] flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b p-3">
          <span className="truncate text-sm font-semibold">
            {result.method} {result.path}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Input
              autoFocus
              placeholder="Search response…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") go(e.shiftKey ? -1 : 1);
              }}
              className="w-64"
            />
            <span className="w-16 shrink-0 text-center text-xs text-muted-foreground">
              {query ? `${count ? active + 1 : 0}/${count}` : ""}
            </span>
            <button
              type="button"
              disabled={!count}
              onClick={() => go(-1)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              aria-label="Previous match"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              disabled={!count}
              onClick={() => go(1)}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
              aria-label="Next match"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-4 text-xs">
          {nodes}
        </pre>
      </div>
    </div>
  );
}
