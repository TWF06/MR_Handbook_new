import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { markdownToText } from "@/lib/markdown";
import type { PublicDocument, PublicSection } from "@/lib/public.functions";

interface Match {
  document: PublicDocument;
  section: PublicSection | undefined;
  snippet: { text: string; hit: boolean }[];
}

function buildSnippet(text: string, term: string): { text: string; hit: boolean }[] {
  const lower = text.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index === -1) return [{ text: text.slice(0, 120), hit: false }];

  const start = Math.max(0, index - 45);
  const end = Math.min(text.length, index + term.length + 75);
  const slice = text.slice(start, end);
  const parts: { text: string; hit: boolean }[] = [];
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");

  let cursor = 0;
  for (const match of slice.matchAll(regex)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push({ text: slice.slice(cursor, at), hit: false });
    parts.push({ text: match[0], hit: true });
    cursor = at + match[0].length;
  }
  if (cursor < slice.length) parts.push({ text: slice.slice(cursor), hit: false });

  if (start > 0) parts.unshift({ text: "…", hit: false });
  if (end < text.length) parts.push({ text: "…", hit: false });
  return parts;
}

export function PublicSearch({
  documents,
  sections,
  onNavigate,
  className,
}: {
  documents: PublicDocument[];
  sections: PublicSection[];
  onNavigate?: () => void;
  className?: string;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const plainBodies = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) map.set(doc.id, markdownToText(doc.content));
    return map;
  }, [documents]);

  const matches: Match[] = useMemo(() => {
    const query = term.trim();
    if (query.length < 2) return [];
    const lower = query.toLowerCase();

    return documents
      .filter((doc) => {
        const body = plainBodies.get(doc.id) ?? "";
        return doc.title.toLowerCase().includes(lower) || body.toLowerCase().includes(lower);
      })
      .slice(0, 8)
      .map((doc) => ({
        document: doc,
        section: sections.find((s) => s.id === doc.section_id),
        snippet: buildSnippet(plainBodies.get(doc.id) ?? "", query),
      }));
  }, [term, documents, plainBodies, sections]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full max-w-md ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search the handbook…"
        aria-label="Search the handbook"
        className="bg-background/70 pl-9 pr-9"
      />
      {term ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setTerm("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open && term.trim().length >= 2 ? (
        <div className="pane-fade absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-popover panel-shadow">
          {matches.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Not found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((match) => (
                <li key={match.document.id}>
                  <Link
                    to="/handbook/$sectionId/$documentId"
                    params={{
                      sectionId: match.document.section_id ?? "",
                      documentId: match.document.id,
                    }}
                    onClick={() => {
                      setOpen(false);
                      setTerm("");
                      onNavigate?.();
                    }}
                    className="block px-4 py-3 transition-colors hover:bg-accent/10"
                  >
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {match.section?.title ?? "Handbook"}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{match.document.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {match.snippet.map((part, index) =>
                        part.hit ? (
                          <mark key={index} className="rounded bg-warning px-0.5 text-warning-foreground">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={index}>{part.text}</span>
                        ),
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
