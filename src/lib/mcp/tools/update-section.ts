import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { actorFor, audit, client, fail, resequenceSections, text } from "../content";

export default defineTool({
  name: "update_section",
  title: "Update a section",
  description:
    "Rename a section, change the stations it targets, or move its position. Fails when the signed-in staff member may not edit it.",
  inputSchema: {
    section_id: z.string().trim().min(1).describe("Section id."),
    title: z.string().trim().min(2).max(200).optional(),
    target_stations: z
      .array(z.string())
      .optional()
      .describe("Station names. Empty means everyone in the library."),
    order_num: z.number().int().min(1).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const db = client(ctx);
    const actor = await actorFor(db, ctx);

    const { data: existing, error: readError } = await db
      .from("sections")
      .select("id, title, library_id")
      .eq("id", input.section_id)
      .maybeSingle();
    if (readError) fail(readError.message);
    if (!existing) fail("No section with that id is visible to this account.");

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload['title'] = input.title;
    if (input.target_stations !== undefined) payload['target_stations'] = input.target_stations;
    if (input.order_num !== undefined) payload['order_num'] = input.order_num;
    if (Object.keys(payload).length === 0) fail("Nothing to change.");

    const { data: updated, error } = await db
      .from("sections")
      .update(payload)
      .eq("id", input.section_id)
      .select("id");
    if (error) fail(error.message);
    if (!updated || updated.length === 0) {
      fail("This account is not allowed to edit that section.");
    }

    await resequenceSections(db, existing.library_id as string);
    await audit(db, actor, `Updated section "${input.title ?? existing.title}" via AI agent`);
    return text({ ok: true, section_id: input.section_id });
  },
});
