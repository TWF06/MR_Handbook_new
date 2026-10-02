import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import {
  actorFor,
  audit,
  client,
  fail,
  newId,
  resequenceSections,
  shiftSections,
  text,
} from "../content";

export default defineTool({
  name: "create_section",
  title: "Create a section",
  description: "Create a section inside a library, targeted at stations or at everyone.",
  inputSchema: {
    library_id: z.string().trim().min(1).describe("Library id from list_libraries."),
    title: z.string().trim().min(2).max(200).describe("Section title."),
    target_stations: z
      .array(z.string())
      .optional()
      .describe("Station names that may see this section. Empty means everyone in the library."),
    order_num: z.number().int().min(1).optional().describe("Position in the library. Default 1."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const db = client(ctx);
    const actor = await actorFor(db, ctx);

    const { data: library, error: libraryError } = await db
      .from("libraries")
      .select("id, title")
      .eq("id", input.library_id)
      .maybeSingle();
    if (libraryError) fail(libraryError.message);
    if (!library) fail("No library with that id exists.");

    const position = input.order_num ?? 1;
    await shiftSections(db, input.library_id, position);

    const id = newId("sec");
    const { error } = await db.from("sections").insert({
      id,
      created_by: actor.employeeId,
      library_id: input.library_id,
      title: input.title,
      target_stations: input.target_stations ?? [],
      order_num: position,
    });
    if (error) fail(error.message);

    await resequenceSections(db, input.library_id);
    await audit(db, actor, `Created section "${input.title}" in ${library.title} via AI agent`);
    return text({ ok: true, section_id: id });
  },
});
