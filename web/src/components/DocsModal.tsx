import { useEffect, useState } from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Full-width modal rendering the project README (integration guide).
export function DocsModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string>("Loading…");

  useEffect(() => {
    fetch("/api/readme")
      .then((r) => r.text())
      .then(setContent)
      .catch((e) => setContent(`Failed to load docs: ${String(e)}`));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-semibold">Docs — Integration guide</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <article className="prose prose-sm max-w-none prose-pre:bg-muted prose-pre:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
}
