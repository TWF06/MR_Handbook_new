import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLocalSupabaseClient } from "@/integrations/supabase/local-db";

export interface PublicSection {
  id: string;
  title: string;
  order_num: number;
  target_category: string;
}

export interface PublicDocument {
  id: string;
  section_id: string | null;
  title: string;
  content: string;
  order_num: number;
  last_updated: string;
}

function createPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];

  if (!key || !url) {
    return createLocalSupabaseClient();
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getPublicSections = createServerFn({ method: "GET" }).handler(async () => {
  const client = createPublicClient();
  const { data: libraries, error: libraryError } = await client
    .from("libraries")
    .select("id")
    .eq("visibility", "public");
  if (libraryError) throw new Error(libraryError.message);
  const ids = (libraries ?? []).map((library: any) => library.id);
  if (ids.length === 0) return [] as PublicSection[];

  const { data, error } = await client
    .from("sections")
    .select("id, title, order_num, target_category")
    .in("library_id", ids)
    .order("order_num", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicSection[];
});

export const getPublicDocuments = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await createPublicClient()
    .from("documents")
    .select("id, section_id, title, content, order_num, last_updated")
    .order("order_num", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicDocument[];
});
