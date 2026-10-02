import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { client, text, unwrap } from "../content";

interface Row {
  id: string;
  section_id: string | null;
  title: string;
  content: string;
  order_num: number;
  last_updated: string;
  target_roles: string[] | null;
  created_by: string | null;
}

export default defineTool({
  name: "list_documents",
  title: "List documents",
  description:
    "List documents the signed-in staff member can read. Optionally filter by library or section, and search titles and body text. Returns metadata and a short excerpt, not the full Markdown.",
  inputSchema: {
    library_id: z.string().trim().optional().describe("Only documents in this library."),
    section_id: z.string().trim().optional().describe("Only documents in this section."),
    search: z.string().trim().optional().describe("Match against title and body text."),
    limit: z.number().int().min(1).max(200).optional().describe("Maximum rows. Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ library_id, section_id, search, limit }, ctx) => {
    const db = client(ctx);

    let sectionIds: string[] | undefined;
    if (library_id) {
      const sections = unwrap<{ id: string }[]>(
        await db.from("sections").select("id").eq("library_id", library_id),
      );
      sectionIds = sections.map((row) => row.id);
      if (sectionIds.length === 0) return text({ documents: [] });
    }

    let query = db
      .from("documents")
      .select(
        "id, section_id, title, content, order_num, last_updated, target_roles, created_by",
      )
      .order("order_num", { ascending: true });
    if (section_id) query = query.eq("section_id", section_id);
    else if (sectionIds) query = query.in("section_id", sectionIds);

    const rows = unwrap<Row[]>(await query);
    const term = search?.toLowerCase();
    const matched = term
      ? rows.filter(
          (row) =>
            row.title.toLowerCase().includes(term) ||
            (row.content ?? "").toLowerCase().includes(term),
        )
      : rows;

    return text({
      documents: matched.slice(0, limit ?? 50).map((row) => ({
        id: row.id,
        section_id: row.section_id,
        title: row.title,
        order_num: row.order_num,
        last_updated: row.last_updated,
        target_roles: row.target_roles ?? [],
        created_by: row.created_by,
        excerpt: (row.content ?? "").slice(0, 240),
      })),
      total_matched: matched.length,
    });
  },
});
