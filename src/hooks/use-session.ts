import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { isAdminLevel, isManagementLevel, roleLabel, roleLevel, type AppRole } from "@/lib/roles";

export interface SessionInfo {
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  departments: string[];
  outlets: string[];
  stations: string[];
  status: string;
  role: AppRole | null;
  roles: AppRole[];
  roleLabel: string;
  level: number;
  isAdmin: boolean;
  isManagement: boolean;
}

export const sessionQueryKey = ["session"] as const;

export async function fetchSession(): Promise<SessionInfo | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("employee_id, name, email, department, status, outlets, stations, departments")
      .eq("id", data.user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role, is_primary").eq("user_id", data.user.id),
  ]);

  if (!profile) return null;

  // Active status check on every session read.
  if (profile.status !== "Active") {
    await supabase.auth.signOut();
    return null;
  }

  const ownRoles = (roles ?? []) as { role: AppRole; is_primary: boolean }[];
  const primary = ownRoles.find((row) => row.is_primary) ?? ownRoles[0];
  const role = (primary?.role ?? null) as AppRole | null;
  const level = roleLevel(role);

  return {
    userId: data.user.id,
    employeeId: profile.employee_id,
    name: profile.name,
    email: profile.email,
    department: profile.department,
    departments: profile.departments ?? [],
    outlets: profile.outlets ?? [],
    stations: profile.stations ?? [],
    status: profile.status,
    role,
    roles: ownRoles.map((row) => row.role),
    roleLabel: roleLabel(role),
    level,
    isAdmin: isAdminLevel(level),
    isManagement: isManagementLevel(level),
  };
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    staleTime: 30_000,
    retry: false,
  });
}
