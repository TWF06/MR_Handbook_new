import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FileText } from "lucide-react";

import { PublicShell } from "@/components/public/public-shell";
import { getPublicDocuments, getPublicSections } from "@/lib/public.functions";
import { formatDate } from "@/lib/time";

export const Route = createFileRoute("/handbook/")({
  head: () => ({
    meta: [
      { title: "Handbook — MR Handbook Manager" },
      {
        name: "description",
        content:
          "Public handbook for MR: company handbooks, SOPs and manuals organised by section.",
      },
      { property: "og:title", content: "Handbook — MR Handbook Manager" },
      {
        property: "og:description",
        content: "Public handbook for MR: company handbooks, SOPs and manuals organised by section.",
      },
    ],
  }),
  loader: async () => {
    const [sections, documents] = await Promise.all([
      getPublicSections({}),
      getPublicDocuments({}),
    ]);
    return { sections, documents };
  },
  component: PublicHandbook,
});

function PublicHandbook() {
  const { sections, documents } = Route.useLoaderData();

  const sectionsWithDocs = sections.filter((section) =>
    documents.some((doc) => doc.section_id === section.id),
  );

  const recent = [...documents]
    .sort((a, b) => b.last_updated.localeCompare(a.last_updated))
    .slice(0, 5);

  return (
    <PublicShell sections={sections} documents={documents}>
      <div className="pane-fade mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Public handbook
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Company handbooks, SOPs and manuals
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every section and document in one place. Staff should sign in for the FAQ board and
          department-scoped content.
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Sections</h2>
          {sectionsWithDocs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No sections published yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {sectionsWithDocs.map((section) => {
                const docs = documents.filter((doc) => doc.section_id === section.id);
                const first = docs[0];
                return (
                  <article
                    key={section.id}
                    className="rounded-2xl border border-border bg-card p-5 panel-shadow"
                  >
                    <h3 className="text-base font-semibold text-card-foreground">{section.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {docs.length} document{docs.length === 1 ? "" : "s"}
                    </p>
                    {first ? (
                      <Link
                        to="/handbook/$sectionId/$documentId"
                        params={{ sectionId: section.id, documentId: first.id }}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                      >
                        Start reading <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {recent.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">Recently updated</h2>
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {recent.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to="/handbook/$sectionId/$documentId"
                    params={{ sectionId: doc.section_id ?? "", documentId: doc.id }}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/10"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-card-foreground">
                      {doc.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(doc.last_updated)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}
