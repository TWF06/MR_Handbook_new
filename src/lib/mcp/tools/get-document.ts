import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { client, fail, text } from "../content";

export default defineTool({
  name: "get_document",
  title: "Read a document",
  description: "Read one document's full Markdown body, targeting tags and last-updated time.",
  inputSchema: { document_id: z.string().trim().min(1).describe("Document id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ document_id }, ctx) => {
    const db = client(ctx);
    const { data, error } = await db
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .maybeSingle();
    if (error) fail(error.message);
    if (!data) fail("No document with that id is visible to this account.");
    return text({ document: data });
  },
});
