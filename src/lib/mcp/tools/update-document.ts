import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { actorFor, audit, client, fail, resequenceDocuments, text } from "../content";

export default defineTool({
  name: "update_document",
  title: "Update a document",
  description:
    "Update a document's title, Markdown body, section, position or targeting tags. Only the fields you pass are changed. Fails when the signed-in staff member may not edit it.",
  inputSchema: {
    document_id: z.string().trim().min(1).describe("Document id."),
    title: z.string().trim().min(2).max(200).optional(),
    content: z.string().min(1).optional().describe("Replacement Markdown body."),
    section_id: z.string().trim().optional().describe("Move it to another section."),
    order_num: z.number().int().min(1).optional(),
    target_roles: z
      .array(z.string())
      .optional()
      .describe("Role keys. Empty means every role that can see the section."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const db = client(ctx);
    const actor = await actorFor(db, ctx);

    const { data: existing, error: readError } = await db
      .from("documents")
      .select("id, title")
      .eq("id", input.document_id)
      .maybeSingle();
    if (readError) fail(readError.message);
    if (!existing) fail("No document with that id is visible to this account.");

    const payload: Record<string, unknown> = { last_updated: new Date().toISOString() };
    if (input.title !== undefined) payload['title'] = input.title;
    if (input.content !== undefined) payload['content'] = input.content;
    if (input.section_id !== undefined) payload['section_id'] = input.section_id;
    if (input.order_num !== undefined) payload['order_num'] = input.order_num;
    if (input.target_roles !== undefined) payload['target_roles'] = input.target_roles;

    const { data: updated, error } = await db
      .from("documents")
      .update(payload)
      .eq("id", input.document_id)
      .select("id");
    if (error) fail(error.message);
    if (!updated || updated.length === 0) {
      fail("This account is not allowed to edit that document.");
    }

    await resequenceDocuments(db);
    await audit(
      db,
      actor,
      `Updated document "${input.title ?? existing.title}" via AI agent`,
    );
    return text({ ok: true, document_id: input.document_id });
  },
});
