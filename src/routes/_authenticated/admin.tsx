import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DocumentsPanel, SectionsPanel } from "@/components/admin/content-tab";
import { MetricsTab } from "@/components/admin/metrics-tab";
import { WorkersTab } from "@/components/admin/workers-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { resetSystemDatabase } from "@/lib/admin.functions";
import { auditLogsQuery } from "@/lib/queries";
import { formatDateTime, searchableDateForms } from "@/lib/time";
import { SystemSettings } from "@/components/admin/system-tab";
import {
  canConfigureLevel,
  canViewAuditLevel,
  canViewStaffLevel,
  isDirectorLevel,
} from "@/lib/roles";

export const ADMIN_TABS = [
  { value: "metrics", label: "Dashboard" },
  { value: "workers", label: "Staffs" },
  { value: "sections", label: "Sections" },
  { value: "documents", label: "Documents" },
  { value: "audit", label: "Audit log" },
  { value: "danger", label: "System" },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["value"];

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (search: Record<string, unknown>): { tab: AdminTab } => {
    const tab = String(search['tab'] ?? "metrics") as AdminTab;
    return { tab: ADMIN_TABS.some((entry) => entry.value === tab) ? tab : "metrics" };
  },
  component: AdminPortal,
});

function AuditPanel({ filter = "" }: { filter?: string }) {
  const { data: logs = [], isLoading } = useQuery(auditLogsQuery);

  const filtered = logs.filter((log) => {
    const query = filter.trim().toLowerCase();
    if (!query) return true;
    const dateForms = searchableDateForms(log.timestamp);
    return (
      log.action.toLowerCase().includes(query) ||
      (log.user_name ?? "").toLowerCase().includes(query) ||
      dateForms.toLowerCase().includes(query)
    );
  });


  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-border bg-card panel-shadow">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-muted-foreground">
                  Loading audit trail…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-muted-foreground">
                  Nothing recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="px-4 py-3 font-medium text-card-foreground">
                    {log.user_name ?? "System"}
                  </td>
                  <td className="px-4 py-3 text-card-foreground">{log.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DangerZone() {
  const queryClient = useQueryClient();
  const reset = useServerFn(resetSystemDatabase);
  const [confirmation, setConfirmation] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (confirmation !== "RESET") throw new Error('Type RESET to confirm.');
      await reset({});
    },
    onSuccess: () => {
      setConfirmation("");
      toast.success("System reset to the current content version");
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="rounded-2xl border border-destructive/40 bg-card p-5 panel-shadow">
      <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
        <AlertTriangle className="h-5 w-5" /> Reset system database
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Will reset handbook to original version and remove all non-management account.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Type RESET to confirm</Label>
          <Input
            id="reset-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="w-40"
          />
        </div>
        <Button type="submit" variant="destructive" disabled={mutation.isPending}>
          {mutation.isPending ? "Resetting…" : "Reset database"}
        </Button>
      </form>
    </section>
  );
}

const FILTER_PLACEHOLDERS: Record<string, string> = {
  workers: "Filter workers by name, role, outlet or station…",
  sections: "Filter sections…",
  documents: "Filter documents by title or audience…",
  audit: "Filter the audit trail by person, action or date…",
};

function AdminPortal() {
  const { data: session, isLoading } = useSession();
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const [filter, setFilter] = useState("");
  const level = session?.level ?? -1;
  const canConfigure = canConfigureLevel(level);
  const canViewStaff = canViewStaffLevel(level);
  const canViewAudit = canViewAuditLevel(level);
  const isDirector = isDirectorLevel(level);
  const allowed =
    (tab === "danger" && !canConfigure) ||
    (tab === "audit" && !canViewAudit) ||
    (tab === "workers" && !canViewStaff)
      ? false
      : true;
  const activeTab = allowed ? tab : "metrics";

  if (isLoading) return <p className="text-sm text-muted-foreground">Checking your access…</p>;

  if (!session?.isAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Manager access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin portal is limited to level 5 and above.
        </p>
        <Button asChild className="mt-6">
          <Link to="/staff">Back to the staff portal</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pane-fade mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin portal</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as {session.roleLabel} (level {session.level}) · {session.department}
      </p>

      {FILTER_PLACEHOLDERS[activeTab] ? (
        <div className="mt-6">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={FILTER_PLACEHOLDERS[activeTab]}
            className="max-w-md"
            aria-label="Filter records"
          />
        </div>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setFilter("");
          navigate({ to: "/admin", search: { tab: value as AdminTab } });
        }}
        className="mt-6"
      >

        <TabsContent value="metrics" className="mt-6">
          <MetricsTab />
        </TabsContent>
        {canViewStaff ? (
          <TabsContent value="workers" className="mt-6">
            <WorkersTab session={session} filter={filter} />
          </TabsContent>
        ) : null}
        <TabsContent value="sections" className="mt-6">
          <SectionsPanel session={session} filter={filter} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <DocumentsPanel session={session} filter={filter} />
        </TabsContent>
        {canViewAudit ? (
          <TabsContent value="audit" className="mt-6">
            <AuditPanel filter={filter} />
          </TabsContent>
        ) : null}
        {canConfigure ? (
          <TabsContent value="danger" className="mt-6">
            <div className="space-y-8">
              <SystemSettings session={session} />
              {isDirector ? <DangerZone /> : null}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
