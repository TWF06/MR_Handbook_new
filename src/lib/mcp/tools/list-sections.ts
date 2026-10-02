import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { client, text, unwrap } from "../content";

export default defineTool({
  name: "list_sections",
  title: "List sections",
  description:
    "List the sections of a library, in display order, with the stations each section targets.",
  inputSchema: {
    library_id: z
      .string()
      .trim()
      .optional()
      .describe("Library id from list_libraries. Defaults to all libraries."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ library_id }, ctx) => {
    const db = client(ctx);
    let query = db
      .from("sections")
      .select("id, library_id, title, order_num, target_stations, created_by")
      .order("order_num", { ascending: true });
    if (library_id) query = query.eq("library_id", library_id);
    return text({ sections: unwrap<unknown[]>(await query) });
  },
});
