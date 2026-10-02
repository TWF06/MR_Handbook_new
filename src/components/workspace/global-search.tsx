import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { markdownToText } from "@/lib/markdown";
import type { HandbookDocument, Library, Section } from "@/lib/queries";

interface Match {
  document: HandbookDocument;
  section: Section | undefined;
  library: Library | undefined;
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

export function GlobalSearch({
  documents,
  sections,
  libraries = [],
  activeLibraryId,
}: {
  documents: HandbookDocument[];
  sections: Section[];
  libraries?: Library[] | undefined;
  activeLibraryId?: string | undefined;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [searchAll, setSearchAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const plainBodies = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) map.set(doc.id, markdownToText(doc.content));
    return map;
  }, [documents]);

  const scoped = Boolean(activeLibraryId) && !searchAll;

  const matches: Match[] = useMemo(() => {
    const query = term.trim();
    if (query.length < 2) return [];
    const lower = query.toLowerCase();

    return documents
      .map((doc) => {
        const section = sections.find((s) => s.id === doc.section_id);
        return { doc, section };
      })
      .filter(({ doc, section }) => {
        if (scoped && section?.library_id !== activeLibraryId) return false;
        const body = plainBodies.get(doc.id) ?? "";
        return doc.title.toLowerCase().includes(lower) || body.toLowerCase().includes(lower);
      })
      .slice(0, 8)
      .map(({ doc, section }) => ({
        document: doc,
        section,
        library: libraries.find((item) => item.id === section?.library_id),
        snippet: buildSnippet(plainBodies.get(doc.id) ?? "", query),
      }));
  }, [term, documents, plainBodies, sections, libraries, scoped, activeLibraryId]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
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
          {activeLibraryId ? (
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
              <span>{scoped ? "This library only" : "All libraries"}</span>
              <button
                type="button"
                onClick={() => setSearchAll((prev) => !prev)}
                className="font-medium text-accent hover:underline"
              >
                {scoped ? "Search all libraries" : "Search this library only"}
              </button>
            </div>
          ) : null}
          {matches.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No documents match “{term}”.</p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((match) => (
                <li key={match.document.id}>
                  <Link
                    to="/staff/$libraryId/$sectionId/$documentId"
                    params={{
                      libraryId: match.library?.slug ?? "handbook",
                      sectionId: match.document.section_id ?? "",
                      documentId: match.document.id,
                    }}
                    onClick={() => {
                      setOpen(false);
                      setTerm("");
                    }}
                    className="block px-4 py-3 transition-colors hover:bg-accent/10"
                  >
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {match.library?.title ? `${match.library.title} · ` : ""}
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
