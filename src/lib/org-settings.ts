import { queryOptions, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { OUTLETS, STATIONS } from "./org";
import { DEPARTMENTS, allRoles, setRoleCatalog, type RoleMeta } from "./roles";

export type OrgKind = "outlet" | "station" | "department" | "role";

export interface OrgSetting {
  id: string;
  kind: OrgKind;
  value: string;
  label: string;
  order_num: number;
  department: string | null;
}

export interface OrgOption {
  value: string;
  label: string;
}

export const orgSettingsQuery = queryOptions({
  queryKey: ["org_settings"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("org_settings")
      .select("id, kind, value, label, order_num, department")
      .order("kind", { ascending: true })
      .order("order_num", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as OrgSetting[];
  },
  staleTime: 60_000,
});

export interface OrgLists {
  settings: OrgSetting[];
  outlets: OrgOption[];
  stations: OrgOption[];
  departments: OrgOption[];
  roles: RoleMeta[];
}

function pick(settings: OrgSetting[], kind: OrgKind): OrgSetting[] {
  return settings.filter((row) => row.kind === kind);
}

function toOptions(rows: OrgSetting[], fallback: readonly string[]): OrgOption[] {
  if (rows.length === 0) return fallback.map((value) => ({ value, label: value }));
  return rows.map((row) => ({ value: row.value, label: row.label }));
}

/**
 * Configurable org lists with a safe fallback to the built-in defaults while
 * the settings table is still loading. `value` is the stored key, `label` is
 * what the System settings page renames.
 */
export function useOrgLists(): OrgLists {
  const { data: settings = [] } = useQuery(orgSettingsQuery);

  const roleRows = pick(settings, "role");
  setRoleCatalog(
    roleRows.map((row) => ({
      value: row.value,
      label: row.label,
      level: row.order_num,
      department: row.department ?? "",
    })),
  );

  return {
    settings,
    outlets: toOptions(pick(settings, "outlet"), OUTLETS),
    stations: toOptions(pick(settings, "station"), STATIONS),
    departments: toOptions(pick(settings, "department"), DEPARTMENTS),
    roles: allRoles(),
  };
}
