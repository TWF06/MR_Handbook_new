import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, MessagesSquare, Users } from "lucide-react";

import { auditLogsQuery, documentsQuery, employeesQuery, sectionsQuery, threadsQuery } from "@/lib/queries";
import { useOrgLists } from "@/lib/org-settings";
import { formatDateTime } from "@/lib/time";

export function MetricsTab() {
  const { data: employees = [] } = useQuery(employeesQuery);
  const { data: sections = [] } = useQuery(sectionsQuery);
  const { data: documents = [] } = useQuery(documentsQuery);
  const { data: threads = [] } = useQuery(threadsQuery);
  const { data: logs = [] } = useQuery(auditLogsQuery);
  const orgLists = useOrgLists();

  const active = employees.filter((worker) => worker.status === "Active").length;
  const openThreads = threads.filter((thread) => !thread.resolved).length;

  const cards = [
    { icon: Users, label: "Employees", value: employees.length, hint: `${active} active` },
    { icon: BookOpen, label: "Sections", value: sections.length, hint: "visible to you" },
    { icon: FileText, label: "Documents", value: documents.length, hint: "published" },
    {
      icon: MessagesSquare,
      label: "FAQ threads",
      value: threads.length,
      hint: `${openThreads} open`,
    },
  ];

  const byDepartment = orgLists.departments.map(({ value: department }) => ({
    department,
    count: employees.filter((worker) => worker.department === department).length,
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-border bg-card p-5 panel-shadow"
          >
            <card.icon className="h-5 w-5 text-primary" aria-hidden />
            <p className="mt-3 text-3xl font-bold tracking-tight text-card-foreground">
              {card.value}
            </p>
            <p className="text-sm font-medium text-card-foreground">{card.label}</p>
            <p className="text-xs text-muted-foreground">{card.hint}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 panel-shadow">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Headcount by department
          </h2>
          <ul className="mt-4 space-y-3">
            {byDepartment.map((row) => {
              const percent = employees.length ? (row.count / employees.length) * 100 : 0;
              return (
                <li key={row.department}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-card-foreground">{row.department}</span>
                    <span className="text-muted-foreground">{row.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 panel-shadow">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Roles filled
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {orgLists.roles.map((role) => (
              <li key={role.value} className="flex items-center justify-between gap-2">
                <span className="truncate text-card-foreground">{role.label}</span>
                <span className="text-muted-foreground">
                  {employees.filter((worker) => worker.role === role.value).length}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 panel-shadow">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Latest activity
        </h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {logs.slice(0, 6).map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(log.timestamp)}
                </span>
                <span className="font-medium text-card-foreground">{log.user_name ?? "System"}</span>
                <span className="text-muted-foreground">{log.action}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
