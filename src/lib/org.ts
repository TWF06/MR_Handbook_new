import { roleLabel, type AppRole } from "./roles";

export const OUTLETS = ["Marco 1U", "Marco TGM", "Rebel Pasta"] as const;

export const STATIONS = [
  "Station 1",
  "Station 2",
  "Station 3",
  "Station 4",
  "Station 5",
] as const;

/**
 * Access is layered: a library targets departments, a section targets stations
 * and a document targets roles. An empty list at any layer means "everyone".
 */
export interface Audience {
  target_roles: AppRole[];
}

/** Short badges describing who can open a document (its roles). */
export function audienceTags(audience: Partial<Audience>): string[] {
  const roles = audience.target_roles ?? [];
  if (roles.length === 0) return ["All roles"];
  return [roles.map((role) => roleLabel(role)).join(", ")];
}

/** One-line audience summary, e.g. "Waiter, Barista". */
export function audienceSummary(audience: Partial<Audience>): string {
  return audienceTags(audience).join(" · ");
}

/** Badge text for the stations a section is shared with. */
export function stationTags(stations: string[] | null | undefined): string[] {
  const list = stations ?? [];
  if (list.length === 0) return ["All stations"];
  return compactGroupLabels(list);
}

/** Badge text for the departments a library is shared with. */
export function departmentTags(departments: string[] | null | undefined): string[] {
  const list = departments ?? [];
  if (list.length === 0) return ["All departments"];
  return list;
}

export interface Assignment {
  outlets: string[];
  stations: string[];
  departments: string[];
  department: string;
  roles: AppRole[];
}

export function overlaps(target: string[] | undefined | null, owned: string[]): boolean {
  return !target || target.length === 0 || target.some((value) => owned.includes(value));
}

/** Does this employee hold one of the roles the document restricts? */
export function matchesAudience(
  employee: Pick<Assignment, "roles">,
  audience: Partial<Audience>,
): boolean {
  return overlaps(audience.target_roles as string[] | undefined, employee.roles as string[]);
}

/**
 * Collapse values that share a leading word into one label, e.g.
 * ["Station 1", "Station 2"] -> "Station 1, 2". Used for outlets and stations.
 */
export function compactGroupLabels(values: string[]): string[] {
  const groups = new Map<string, string[]>();
  for (const value of values) {
    const match = value.match(/^(.*?)[\s-]+([^\s-]+)$/);
    const prefix = match?.[1] ?? value;
    const suffix = match?.[2] ?? "";
    const list = groups.get(prefix) ?? [];
    list.push(suffix);
    groups.set(prefix, list);
  }
  return [...groups.entries()].map(([prefix, suffixes]) =>
    suffixes.filter(Boolean).length > 0 ? `${prefix} ${suffixes.join(", ")}` : prefix,
  );
}
