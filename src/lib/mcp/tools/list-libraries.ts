import { defineTool } from "@lovable.dev/mcp-js";

import { client, text, unwrap } from "../content";

export default defineTool({
  name: "list_libraries",
  title: "List libraries",
  description:
    "List the document libraries (document trees) available to the signed-in staff member, such as Handbook or FOH Training.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const db = client(ctx);
    const rows = unwrap<unknown[]>(
      await db
        .from("libraries")
        .select("id, slug, title, order_num, visibility")
        .order("order_num", { ascending: true }),
    );
    return text({ libraries: rows });
  },
});
