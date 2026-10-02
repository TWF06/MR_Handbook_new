import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { stationTags } from "@/lib/org";
import { documentsQuery, librariesQuery, sectionsQuery } from "@/lib/queries";
import { formatDate } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/staff/$libraryId/")({
  component: LibraryOverview,
});

function LibraryOverview() {
  const { libraryId } = Route.useParams();
  const { data: libraries = [], isLoading: loadingLibraries } = useQuery(librariesQuery);
  const { data: allSections = [], isLoading } = useQuery(sectionsQuery);
  const { data: documents = [] } = useQuery(documentsQuery);

  const library = libraries.find((item) => item.slug === libraryId);

  if (!loadingLibraries && !library) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Library not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been renamed or removed.
        </p>
        <Button asChild className="mt-6">
          <Link to="/staff">Back to libraries</Link>
        </Button>
      </div>
    );
  }

  const librarySections = allSections.filter((section) => section.library_id === library?.id);
  const sectionIds = new Set(librarySections.map((section) => section.id));
  const visibleDocuments = documents.filter(
    (doc) => doc.section_id && sectionIds.has(doc.section_id),
  );
  const sections = librarySections.filter((section) =>
    visibleDocuments.some((doc) => doc.section_id === section.id),
  );

  const recent = [...visibleDocuments]
    .sort((a, b) => b.last_updated.localeCompare(a.last_updated))
    .slice(0, 5);

  return (
    <div className="pane-fade mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Library</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
        {library?.title ?? "Library"}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        These are the sections available at your access level. Use search to jump straight to a
        procedure, or open the FAQ board to ask the team.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Your sections</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading sections…</p>
        ) : sections.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No sections in this library are shared with your role yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {sections.map((section) => {
              const docs = visibleDocuments.filter((doc) => doc.section_id === section.id);
              const first = docs[0];
              return (
                <article
                  key={section.id}
                  className="rounded-2xl border border-border bg-card p-5 panel-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-card-foreground">
                      {section.title}
                    </h3>
                    <div className="flex flex-wrap justify-end gap-1">
                      {stationTags(section.target_stations).map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {docs.length} document{docs.length === 1 ? "" : "s"}
                  </p>
                  {first ? (
                    <Link
                      to="/staff/$libraryId/$sectionId/$documentId"
                      params={{ libraryId, sectionId: section.id, documentId: first.id }}
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
                  to="/staff/$libraryId/$sectionId/$documentId"
                  params={{
                    libraryId,
                    sectionId: doc.section_id ?? "",
                    documentId: doc.id,
                  }}
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
  );
}
