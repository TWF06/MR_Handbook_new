import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Library as LibraryIcon } from "lucide-react";

import { useSession } from "@/hooks/use-session";
import { documentsQuery, librariesQuery, sectionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffOverview,
});

function StaffOverview() {
  const { data: session } = useSession();
  const { data: libraries = [], isLoading } = useQuery(librariesQuery);
  const { data: sections = [] } = useQuery(sectionsQuery);
  const { data: documents = [] } = useQuery(documentsQuery);

  const visibleSectionIds = new Set(sections.map((section) => section.id));
  const visibleDocuments = documents.filter(
    (doc) => doc.section_id && visibleSectionIds.has(doc.section_id),
  );

  const trees = libraries.map((library) => {
    const librarySections = sections.filter((section) => section.library_id === library.id);
    const ids = new Set(librarySections.map((section) => section.id));
    const docs = visibleDocuments.filter((doc) => ids.has(doc.section_id ?? ""));
    return { library, sectionCount: librarySections.length, docCount: docs.length };
  });

  return (
    <div className="pane-fade mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        {session?.department} · {session?.roleLabel}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
        Welcome, {session?.name?.split(" ")[0]}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Choose a library to read. Each library keeps its own sections and documents, filtered to your
        access level.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Libraries</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading libraries…</p>
        ) : trees.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No libraries have been set up yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {trees.map(({ library, sectionCount, docCount }) => (
              <article
                key={library.id}
                className="rounded-2xl border border-border bg-card p-5 panel-shadow"
              >
                <div className="flex items-center gap-2">
                  <LibraryIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <h3 className="text-base font-semibold text-card-foreground">{library.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sectionCount} section{sectionCount === 1 ? "" : "s"} · {docCount} document
                  {docCount === 1 ? "" : "s"} you can open
                </p>
                <Link
                  to="/staff/$libraryId"
                  params={{ libraryId: library.slug }}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  Open <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
