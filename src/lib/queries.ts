import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./roles";

export interface Library {
  id: string;
  slug: string;
  title: string;
  order_num: number;
  visibility: string;
  target_departments: string[];
}

export interface Section {
  id: string;
  title: string;
  order_num: number;
  target_category: string;
  target_stations: string[];
  created_by: string | null;
  library_id: string;
}

export interface HandbookDocument {
  id: string;
  section_id: string | null;
  title: string;
  content: string;
  order_num: number;
  last_updated: string;
  target_outlets: string[];
  target_stations: string[];
  target_departments: string[];
  target_roles: AppRole[];
  created_by: string | null;
}

export interface FaqThread {
  id: string;
  author_id: string | null;
  author_name: string;
  title: string;
  created_at: string;
  resolved: boolean;
  pinned_reply_id: string | null;
}

export interface FaqReply {
  id: string;
  thread_id: string | null;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  status: string;
  last_login_at: string | null;
  role: AppRole | null;
  roles: AppRole[];
  outlets: string[];
  stations: string[];
  departments: string[];
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  timestamp: string;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

export const librariesQuery = queryOptions({
  queryKey: ["libraries"],
  queryFn: async () =>
    unwrap<Library[]>(
      await supabase
        .from("libraries")
        .select("id, slug, title, order_num, visibility, target_departments")
        .order("order_num", { ascending: true }),
    ),
});

export const sectionsQuery = queryOptions({
  queryKey: ["sections"],
  queryFn: async () =>
    unwrap<Section[]>(
      await supabase.from("sections").select("*").order("order_num", { ascending: true }),
    ),
});

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: async () =>
    unwrap<HandbookDocument[]>(
      await supabase.from("documents").select("*").order("order_num", { ascending: true }),
    ),
});

export const threadsQuery = queryOptions({
  queryKey: ["faq_threads"],
  queryFn: async () =>
    unwrap<FaqThread[]>(
      await supabase.from("faq_threads").select("*").order("created_at", { ascending: false }),
    ),
});

export function repliesQuery(threadId: string) {
  return queryOptions({
    queryKey: ["faq_replies", threadId],
    queryFn: async () =>
      unwrap<FaqReply[]>(
        await supabase
          .from("faq_replies")
          .select("*")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
      ),
  });
}

export const replyCountsQuery = queryOptions({
  queryKey: ["faq_reply_counts"],
  queryFn: async () => {
    const rows = unwrap<{ thread_id: string | null }[]>(
      await supabase.from("faq_replies").select("thread_id"),
    );
    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.thread_id) continue;
      counts[row.thread_id] = (counts[row.thread_id] ?? 0) + 1;
    }
    return counts;
  },
});

export const employeesQuery = queryOptions({
  queryKey: ["employees"],
  queryFn: async (): Promise<Employee[]> => {
    const profiles = unwrap<Omit<Employee, "role" | "roles">[]>(
      await supabase
        .from("profiles")
        .select("id, employee_id, name, email, department, status, last_login_at, outlets, stations, departments")
        .order("employee_id", { ascending: true }),
    );
    const roles = unwrap<{ user_id: string; role: AppRole; is_primary: boolean }[]>(
      await supabase.from("user_roles").select("user_id, role, is_primary"),
    );
    return profiles.map((profile) => {
      const own = roles.filter((row) => row.user_id === profile.id);
      const primary = own.find((row) => row.is_primary) ?? own[0];
      return {
        ...profile,
        role: primary?.role ?? null,
        roles: own.map((row) => row.role),
      };
    });
  },
});

export const auditLogsQuery = queryOptions({
  queryKey: ["audit_logs"],
  queryFn: async () =>
    unwrap<AuditLog[]>(
      await supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(200),
    ),
});

/** Writes an audit entry as the current employee. */
export async function recordAudit(employeeId: string, userName: string, action: string) {
  await supabase.from("audit_logs").insert({ user_id: employeeId, user_name: userName, action });
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
