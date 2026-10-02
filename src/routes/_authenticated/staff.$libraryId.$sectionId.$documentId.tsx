import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { TableOfContents } from "@/components/workspace/table-of-contents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractHeadings, renderMarkdown } from "@/lib/markdown";
import { audienceTags, stationTags } from "@/lib/org";
import { documentsQuery, librariesQuery, sectionsQuery } from "@/lib/queries";
import { formatDateTimeWithZone } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/staff/$libraryId/$sectionId/$documentId")({
  component: StaffDocumentPage,
});

function StaffDocumentPage() {
  const { libraryId, sectionId, documentId } = Route.useParams();
  const { data: libraries = [] } = useQuery(librariesQuery);
  const { data: allSections = [] } = useQuery(sectionsQuery);
  const { data: documents = [], isLoading } = useQuery(documentsQuery);

  const library = libraries.find((item) => item.slug === libraryId);
  const sections = useMemo(
    () => allSections.filter((section) => section.library_id === library?.id),
    [allSections, library?.id],
  );

  const section = sections.find((item) => item.id === sectionId);
  const document = documents.find((item) => item.id === documentId);

  const ordered = useMemo(() => {
    const bySection = new Map(sections.map((item, index) => [item.id, index]));
    return documents
      .filter((doc) => bySection.has(doc.section_id ?? ""))
      .sort((a, b) => {
        const sa = bySection.get(a.section_id ?? "") ?? 999;
        const sb = bySection.get(b.section_id ?? "") ?? 999;
        return sa === sb ? a.order_num - b.order_num : sa - sb;
      });
  }, [documents, sections]);

  const position = ordered.findIndex((item) => item.id === documentId);
  const previous = position > 0 ? ordered[position - 1] : undefined;
  const next = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : undefined;

  const html = useMemo(() => (document ? renderMarkdown(document.content) : ""), [document]);
  const headings = useMemo(() => (document ? extractHeadings(document.content) : []), [document]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading document…</p>;
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Document unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been moved, or your role no longer has access to it.
        </p>
        <Button asChild className="mt-6">
          <Link to="/staff">Back to libraries</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pane-fade mx-auto flex w-full max-w-6xl gap-10">
      <article className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link to="/staff/$libraryId" params={{ libraryId }} className="hover:text-foreground">
            {library?.title ?? "Library"}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{section?.title ?? "Section"}</span>
          {section
            ? stationTags(section.target_stations).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))
            : null}
          {audienceTags(document).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Last updated {formatDateTimeWithZone(document.last_updated)}
        </p>

        <details className="mt-4 rounded-xl border border-border bg-card p-4 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium text-card-foreground">
            On this page
          </summary>
          <div className="mt-3">
            <TableOfContents headings={headings} />
          </div>
        </details>

        <div className="doc-prose mt-6" dangerouslySetInnerHTML={{ __html: html }} />

        <nav className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {previous ? (
            <Button asChild variant="outline" className="justify-start">
              <Link
                to="/staff/$libraryId/$sectionId/$documentId"
                params={{
                  libraryId,
                  sectionId: previous.section_id ?? "",
                  documentId: previous.id,
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> {previous.title}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button asChild variant="outline" className="justify-end">
              <Link
                to="/staff/$libraryId/$sectionId/$documentId"
                params={{ libraryId, sectionId: next.section_id ?? "", documentId: next.id }}
              >
                {next.title} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      </article>

      <aside className="sticky top-24 hidden h-fit w-60 shrink-0 lg:block">
        <TableOfContents headings={headings} />
      </aside>
    </div>
  );
}
