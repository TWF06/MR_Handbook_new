import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, Moon, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";

import { PublicSearch } from "@/components/public/public-search";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/use-theme";
import type { PublicDocument, PublicSection } from "@/lib/public.functions";

interface NavProps {
  sections: PublicSection[];
  documents: PublicDocument[];
  onNavigate?: () => void;
}

function PublicNavigation({ sections, documents, onNavigate }: NavProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex flex-col gap-1 pb-8" aria-label="Handbook navigation">
      <Link
        to="/handbook"
        onClick={onNavigate}
        activeOptions={{ exact: true }}
        activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        className="rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
      >
        Overview
      </Link>

      {sections.map((section) => {
        const docs = documents.filter((doc) => doc.section_id === section.id);
        if (docs.length === 0) return null;
        const isCollapsed = collapsed[section.id] ?? false;
        return (
          <div key={section.id} className="mt-2">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [section.id]: !isCollapsed }))}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-sidebar-foreground"
              aria-expanded={!isCollapsed}
            >
              <span className="truncate">{section.title}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                aria-hidden
              />
            </button>
            {!isCollapsed ? (
              <ul className="mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
                {docs.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      to="/handbook/$sectionId/$documentId"
                      params={{ sectionId: section.id, documentId: doc.id }}
                      onClick={onNavigate}
                      activeProps={{
                        className: "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                      }}
                      className="block rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent/60"
                    >
                      <span className="block truncate">{doc.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** Public handbook layout: same sidebar shape as the staff portal, no login. */
export function PublicShell({
  sections,
  documents,
  children,
}: {
  sections: PublicSection[];
  documents: PublicDocument[];
  children: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border glass-panel">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-4">
              <SheetTitle className="mb-4 text-sm font-semibold">Handbook</SheetTitle>
              <PublicSearch
                sections={sections}
                documents={documents}
                onNavigate={() => setMobileOpen(false)}
                className="mb-4 sm:hidden"
              />
              <PublicNavigation
                sections={sections}
                documents={documents}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <Link to="/handbook" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">
              MR
            </span>
            <span className="hidden sm:inline">Handbook Manager</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <PublicSearch sections={sections} documents={documents} className="hidden sm:block" />
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Staff sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-72 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 lg:block">
          <PublicNavigation sections={sections} documents={documents} />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        MR Handbook Manager — internal use only.
      </footer>
    </div>
  );
}
