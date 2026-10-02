import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseForUser } from "./supabase";

export type Client = SupabaseClient<any, any, any>;

export interface Actor {
  employeeId: string;
  name: string;
}

/** Resolves the acting staff member from the verified token. */
export async function actorFor(client: Client, ctx: ToolContext): Promise<Actor> {
  const userId = ctx.getUserId();
  if (!userId) throw new ToolError("Not signed in.");
  const { data, error } = await client
    .from("profiles")
    .select("employee_id, name, status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ToolError(error.message);
  if (!data) throw new ToolError("No staff profile is linked to this account.");
  if (data.status !== "Active") throw new ToolError("This account is disabled.");
  return { employeeId: data.employee_id as string, name: data.name as string };
}

export function client(ctx: ToolContext): Client {
  if (!ctx.isAuthenticated()) throw new ToolError("Not signed in.");
  return supabaseForUser(ctx) as unknown as Client;
}

export async function audit(client: Client, actor: Actor, action: string) {
  await client
    .from("audit_logs")
    .insert({ user_id: actor.employeeId, user_name: actor.name, action });
}

export function fail(message: string): never {
  throw new ToolError(message);
}

export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) fail(result.error.message);
  return (result.data ?? []) as T;
}

export function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

/** Makes room at `from` by pushing later sections one place back. */
export async function shiftSections(client: Client, libraryId: string, from: number) {
  const rows = unwrap<{ id: string; order_num: number }[]>(
    await client
      .from("sections")
      .select("id, order_num")
      .eq("library_id", libraryId)
      .gte("order_num", from)
      .order("order_num", { ascending: false }),
  );
  for (const row of rows) {
    const { error } = await client
      .from("sections")
      .update({ order_num: row.order_num + 1 })
      .eq("id", row.id);
    if (error) fail(error.message);
  }
}

export async function shiftDocuments(client: Client, sectionId: string, from: number) {
  const rows = unwrap<{ id: string; order_num: number }[]>(
    await client
      .from("documents")
      .select("id, order_num")
      .eq("section_id", sectionId)
      .gte("order_num", from)
      .order("order_num", { ascending: false }),
  );
  for (const row of rows) {
    const { error } = await client
      .from("documents")
      .update({ order_num: row.order_num + 1 })
      .eq("id", row.id);
    if (error) fail(error.message);
  }
}

/** Renumbers a library's sections 1..n. */
export async function resequenceSections(client: Client, libraryId: string) {
  const rows = unwrap<{ id: string; order_num: number }[]>(
    await client
      .from("sections")
      .select("id, order_num, title")
      .eq("library_id", libraryId)
      .order("order_num", { ascending: true })
      .order("title", { ascending: true }),
  );
  for (const [index, row] of rows.entries()) {
    if (row.order_num === index + 1) continue;
    const { error } = await client
      .from("sections")
      .update({ order_num: index + 1 })
      .eq("id", row.id);
    if (error) fail(error.message);
  }
}

/** Renumbers documents 1..n inside every section. */
export async function resequenceDocuments(client: Client) {
  const rows = unwrap<{ id: string; order_num: number; section_id: string | null }[]>(
    await client
      .from("documents")
      .select("id, order_num, section_id, title")
      .order("order_num", { ascending: true })
      .order("title", { ascending: true }),
  );
  const counters = new Map<string, number>();
  for (const row of rows) {
    const key = row.section_id ?? "";
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    if (row.order_num === next) continue;
    const { error } = await client.from("documents").update({ order_num: next }).eq("id", row.id);
    if (error) fail(error.message);
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
