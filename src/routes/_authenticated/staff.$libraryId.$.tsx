import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy bookmarks: `/staff/<section>/<document>` predates libraries. Anything
 * that reaches this catch-all is redirected into the Handbook library.
 */
export const Route = createFileRoute("/_authenticated/staff/$libraryId/$")({
  beforeLoad: ({ params }) => {
    const rest = (params._splat ?? "").split("/").filter(Boolean);
    if (rest.length === 1) {
      throw redirect({
        to: "/staff/$libraryId/$sectionId/$documentId",
        params: {
          libraryId: "handbook",
          sectionId: params.libraryId,
          documentId: rest[0]!,
        },
        replace: true,
      });
    }
    throw redirect({ to: "/staff", replace: true });
  },
  component: () => null,
});
