import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMemo } from "react";

import { TableOfContents } from "@/components/workspace/table-of-contents";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public/public-shell";
import { extractHeadings, renderMarkdown } from "@/lib/markdown";
import { getPublicDocuments, getPublicSections } from "@/lib/public.functions";
import { formatDateTimeWithZone } from "@/lib/time";

export const Route = createFileRoute("/handbook/$sectionId/$documentId")({
  head: ({ loaderData, params }) => {
    const doc = loaderData?.documents.find((item) => item.id === params.documentId);
    const section = loaderData?.sections.find((item) => item.id === params.sectionId);
    const title = doc?.title ?? "Document";
    return {
      meta: [
        { title: `${title} — MR Handbook` },
        {
          name: "description",
          content: `Read ${title}${section ? ` in ${section.title}` : ""} from the MR public handbook.`,
        },
        { property: "og:title", content: `${title} — MR Handbook` },
        {
          property: "og:description",
          content: `Read ${title}${section ? ` in ${section.title}` : ""} from the MR public handbook.`,
        },
      ],
    };
  },
  loader: async () => {
    const [sections, documents] = await Promise.all([
      getPublicSections({}),
      getPublicDocuments({}),
    ]);
    return { sections, documents };
  },
  component: PublicDocumentPage,
});

function PublicDocumentPage() {
  const { sectionId, documentId } = Route.useParams();
  const { sections, documents } = Route.useLoaderData();

  const section = sections.find((item) => item.id === sectionId);
  const document = documents.find((item) => item.id === documentId);

  const ordered = useMemo(() => {
    const bySection = new Map(sections.map((item, index) => [item.id, index]));
    return [...documents].sort((a, b) => {
      const sa = bySection.get(a.section_id ?? "") ?? 999;
      const sb = bySection.get(b.section_id ?? "") ?? 999;
      return sa === sb ? a.order_num - b.order_num : sa - sb;
    });
  }, [documents, sections]);

  const position = ordered.findIndex((item) => item.id === documentId);
  const previous = position > 0 ? ordered[position - 1] : undefined;
  const next = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : undefined;

  const html = useMemo(() => (document ? renderMarkdown(document.content) : ""), [document]);
  const headings = useMemo(
    () => (document ? extractHeadings(document.content) : []),
    [document],
  );

  if (!document) {
    throw notFound();
  }

  return (
    <PublicShell sections={sections} documents={documents}>
      <div className="pane-fade mx-auto flex w-full max-w-5xl gap-10">
        <article className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link to="/handbook" className="hover:text-foreground">
              Handbook
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">{section?.title ?? "Section"}</span>
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
                  to="/handbook/$sectionId/$documentId"
                  params={{ sectionId: previous.section_id ?? "", documentId: previous.id }}
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
                  to="/handbook/$sectionId/$documentId"
                  params={{ sectionId: next.section_id ?? "", documentId: next.id }}
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
    </PublicShell>
  );
}
