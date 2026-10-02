import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { actorFor, audit, client, fail, resequenceDocuments, text } from "../content";

export default defineTool({
  name: "delete_document",
  title: "Delete a document",
  description:
    "Permanently delete a document. Fails when the signed-in staff member may not edit it.",
  inputSchema: { document_id: z.string().trim().min(1).describe("Document id.") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ document_id }, ctx) => {
    const db = client(ctx);
    const actor = await actorFor(db, ctx);

    const { data: existing, error: readError } = await db
      .from("documents")
      .select("id, title")
      .eq("id", document_id)
      .maybeSingle();
    if (readError) fail(readError.message);
    if (!existing) fail("No document with that id is visible to this account.");

    const { data: removed, error } = await db
      .from("documents")
      .delete()
      .eq("id", document_id)
      .select("id");
    if (error) fail(error.message);
    if (!removed || removed.length === 0) {
      fail("This account is not allowed to delete that document.");
    }

    await resequenceDocuments(db);
    await audit(db, actor, `Deleted document "${existing.title}" via AI agent`);
    return text({ ok: true });
  },
});
