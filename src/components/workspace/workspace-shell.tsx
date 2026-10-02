import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { ChangePasswordDialog } from "@/components/workspace/change-password-dialog";
import { GlobalSearch } from "@/components/workspace/global-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { audienceSummary, compactGroupLabels } from "@/lib/org";
import { canConfigureLevel, canViewAuditLevel, canViewStaffLevel, roleLabel } from "@/lib/roles";
import type { AdminTab } from "@/routes/_authenticated/admin";
import { documentsQuery, librariesQuery, recordAudit, sectionsQuery } from "@/lib/queries";

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const search = useSearch({ strict: false }) as { tab?: string };
  const active = search.tab ?? "metrics";
  const level = session?.level ?? -1;

  const allLinks: { tab: AdminTab; label: string; visible: boolean }[] = [
    { tab: "metrics", label: "Dashboard", visible: true },
    { tab: "workers", label: "Staffs", visible: canViewStaffLevel(level) },
    { tab: "sections", label: "Sections", visible: true },
    { tab: "documents", label: "Documents", visible: true },
    { tab: "audit", label: "Audit log", visible: canViewAuditLevel(level) },
    { tab: "danger", label: "System", visible: canConfigureLevel(level) },
  ];
  const links = allLinks.filter((link) => link.visible);

  return (
    <nav className="flex flex-col gap-1 pb-8" aria-label="Admin navigation">
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Admin portal
      </p>
      {links.map((link) => (
        <Link
          key={link.tab}
          to="/admin"
          search={{ tab: link.tab }}
          onClick={onNavigate}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent/60 ${
            active === link.tab
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function Navigation({
  onNavigate,
  librarySlug,
}: {
  onNavigate?: () => void;
  librarySlug?: string | undefined;
}) {
  const { data: libraries = [] } = useQuery(librariesQuery);
  const { data: allSections = [] } = useQuery(sectionsQuery);
  const { data: documents = [] } = useQuery(documentsQuery);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const activeLibrary =
    libraries.find((item) => item.slug === librarySlug) ?? libraries[0];
  const sections = allSections.filter((section) => section.library_id === activeLibrary?.id);

  return (
    <nav className="flex flex-col gap-1 pb-8" aria-label="Staff handbook navigation">
      <Link
        to="/staff"
        onClick={onNavigate}
        activeOptions={{ exact: true }}
        activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
        className="rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
      >
        All libraries
      </Link>

      {libraries.length > 0 ? (
        <div className="mt-3">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Libraries
          </p>
          {libraries.map((library) => (
            <Link
              key={library.id}
              to="/staff/$libraryId"
              params={{ libraryId: library.slug }}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/60 ${
                library.id === activeLibrary?.id
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/90"
              }`}
            >
              {library.title}
            </Link>
          ))}
        </div>
      ) : null}

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
                {docs.length === 0 ? (
                  <li className="px-3 py-1.5 text-xs text-muted-foreground">No documents yet</li>
                ) : (
                  docs.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        to="/staff/$libraryId/$sectionId/$documentId"
                        params={{
                          libraryId: activeLibrary?.slug ?? "handbook",
                          sectionId: section.id,
                          documentId: doc.id,
                        }}
                        onClick={onNavigate}
                        activeProps={{
                          className: "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                        }}
                        className="block rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent/60"
                      >
                        <span className="block truncate">{doc.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {audienceSummary(doc)}
                        </span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { data: sections = [] } = useQuery(sectionsQuery);
  const { data: documents = [] } = useQuery(documentsQuery);
  const { data: libraries = [] } = useQuery(librariesQuery);
  const params = useParams({ strict: false }) as { libraryId?: string };
  const librarySlug = params.libraryId;
  const activeLibraryId = libraries.find((item) => item.slug === librarySlug)?.id;
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");
  const isStaffPage = location.pathname.startsWith("/staff");
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  async function signOut() {
    if (session) {
      await recordAudit(session.employeeId, session.name, "Signed out");
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (session?.name ?? "")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
              <SheetTitle className="mb-4 text-sm font-semibold">
                {isAdminPage ? "Admin portal" : "Staff portal"}
              </SheetTitle>
              {isAdminPage ? (
                <AdminNavigation onNavigate={() => setMobileOpen(false)} />
              ) : (
                <Navigation onNavigate={() => setMobileOpen(false)} librarySlug={librarySlug} />
              )}
            </SheetContent>
          </Sheet>

          <Link to={isAdminPage ? "/staff" : "/staff"} className="flex items-center gap-2 font-semibold text-foreground">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">
              MR
            </span>
            <span className="hidden sm:inline">Handbook Manager</span>
          </Link>

          <div className="ml-auto flex flex-1 items-center justify-end gap-2">
            <div className="hidden flex-1 justify-end md:flex">
              <GlobalSearch documents={documents} sections={sections} libraries={libraries} activeLibraryId={activeLibraryId} />
            </div>

            <Button asChild variant="ghost" size="icon" aria-label="FAQ board">
              <Link to="/staff/faq">
                <MessagesSquare className="h-5 w-5" />
              </Link>
            </Button>

            {session?.isAdmin ? (
              <Button asChild variant="ghost" size="icon" aria-label={isAdminPage ? "Staff portal" : "Admin portal"}>
                <Link to={isAdminPage ? "/staff" : "/admin"}>
                  {isAdminPage ? <BookOpen className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </Link>
              </Button>
            ) : null}

            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  aria-label="Account menu"
                >
                  {initials || "?"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{session?.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{session?.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="outline">L{session?.level}</Badge>
                    <Badge variant="secondary">{session?.roleLabel}</Badge>
                    {(session?.roles ?? [])
                      .filter((role) => role !== session?.role)
                      .map((role) => (
                        <Badge key={role} variant="secondary">
                          {roleLabel(role)}
                        </Badge>
                      ))}
                    {[session?.department, ...(session?.departments ?? [])]
                      .filter((dept, index, all): dept is string =>
                        Boolean(dept) && all.indexOf(dept) === index,
                      )
                      .map((dept) => (
                        <Badge key={dept} variant="outline">
                          {dept}
                        </Badge>
                      ))}
                    {compactGroupLabels(session?.outlets ?? []).map((outlet) => (
                      <Badge key={outlet} variant="outline">
                        {outlet}
                      </Badge>
                    ))}
                    {compactGroupLabels(session?.stations ?? []).map((station) => (
                      <Badge key={station} variant="outline">
                        {station}
                      </Badge>
                    ))}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {session?.isAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link to={isAdminPage ? "/staff" : "/admin"}>
                      {isAdminPage ? "Staff portal" : "Admin portal"}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link to="/staff/faq">FAQ board</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" /> Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <GlobalSearch documents={documents} sections={sections} libraries={libraries} activeLibraryId={activeLibraryId} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-72 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 lg:block">
          {isAdminPage ? <AdminNavigation /> : <Navigation librarySlug={librarySlug} />}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        employeeId={session?.employeeId}
        name={session?.name}
      />
      <div className="hidden">
      </div>
    </div>
  );
}
