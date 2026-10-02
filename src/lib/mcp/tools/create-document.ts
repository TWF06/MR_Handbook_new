import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import {
  actorFor,
  audit,
  client,
  fail,
  newId,
  resequenceDocuments,
  shiftDocuments,
  text,
} from "../content";

export default defineTool({
  name: "create_document",
  title: "Create a document",
  description:
    "Create a Markdown document inside a section. Fails when the signed-in staff member is not allowed to publish there.",
  inputSchema: {
    section_id: z.string().trim().min(1).describe("Section id from list_sections."),
    title: z.string().trim().min(2).max(200).describe("Document title."),
    content: z.string().min(1).describe("Markdown body."),
    order_num: z.number().int().min(1).optional().describe("Position in the section. Default 1."),
    target_roles: z
      .array(z.string())
      .optional()
      .describe("Role keys that may read it. Empty means every role that can see the section."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const db = client(ctx);
    const actor = await actorFor(db, ctx);

    const { data: section, error: sectionError } = await db
      .from("sections")
      .select("id, title, library_id")
      .eq("id", input.section_id)
      .maybeSingle();
    if (sectionError) fail(sectionError.message);
    if (!section) fail("No section with that id is visible to this account.");

    const position = input.order_num ?? 1;
    await shiftDocuments(db, input.section_id, position);

    const id = newId("doc");
    const { error } = await db.from("documents").insert({
      id,
      created_by: actor.employeeId,
      section_id: input.section_id,
      title: input.title,
      content: input.content,
      order_num: position,
      last_updated: new Date().toISOString(),
      target_roles: (input.target_roles ?? []) as never[],
    });
    if (error) fail(error.message);

    await resequenceDocuments(db);
    await audit(db, actor, `Published document "${input.title}" via AI agent`);
    return text({ ok: true, document_id: id, section: section.title });
  },
});
