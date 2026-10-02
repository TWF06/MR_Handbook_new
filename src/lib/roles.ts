/**
 * Built-in role keys plus any custom role a Director adds from the System
 * settings page, so the type stays open while keeping autocomplete.
 */
export type BuiltInRole =
  | "director"
  | "hr"
  | "administrative"
  | "boh_manager"
  | "foh_manager"
  | "cdp"
  | "sous"
  | "boh_crew"
  | "waiter"
  | "cashier"
  | "barista";

export type AppRole = BuiltInRole | (string & {});

export type Department = "Management" | "BOH" | "FOH" | (string & {});

export interface RoleMeta {
  value: AppRole;
  label: string;
  level: number;
  department: Department;
}

export const ROLES: RoleMeta[] = [
  { value: "director", label: "Director", level: 9, department: "Management" },
  { value: "administrative", label: "Admin", level: 8, department: "Management" },
  { value: "hr", label: "HR (Editor)", level: 7, department: "Management" },
  { value: "boh_manager", label: "BOH Manager", level: 6, department: "BOH" },
  { value: "foh_manager", label: "FOH Manager", level: 5, department: "FOH" },
  { value: "cdp", label: "CDP", level: 4, department: "BOH" },
  { value: "sous", label: "SOUS", level: 3, department: "BOH" },
  { value: "boh_crew", label: "BOH Crew", level: 2, department: "BOH" },
  { value: "waiter", label: "Waiter", level: 1, department: "FOH" },
  { value: "cashier", label: "Cashier", level: 1, department: "FOH" },
  { value: "barista", label: "Barista", level: 0, department: "FOH" },
];


export const DEPARTMENTS: Department[] = ["Management", "BOH", "FOH"];

/**
 * Live catalog of roles. It starts as the built-in list and is replaced by the
 * rows configured in the System settings page (name, level, department), so
 * custom roles behave exactly like the built-in ones.
 */
let catalog: RoleMeta[] = [...ROLES];
let byValue = new Map(catalog.map((r) => [r.value, r]));

function sortRoles(rows: RoleMeta[]): RoleMeta[] {
  return [...rows].sort((a, b) => b.level - a.level || a.label.localeCompare(b.label));
}

/** Replaces the catalog with the configured roles (highest level first). */
export function setRoleCatalog(
  entries: { value: string; label: string; level: number; department: string }[],
): void {
  if (entries.length === 0) {
    catalog = sortRoles(ROLES);
  } else {
    catalog = sortRoles(
      entries.map((entry) => ({
        value: entry.value,
        label: entry.label,
        level: entry.level,
        department:
          entry.department || ROLES.find((r) => r.value === entry.value)?.department || "Management",
      })),
    );
  }
  byValue = new Map(catalog.map((r) => [r.value, r]));
}

export function roleMeta(role: AppRole | null | undefined): RoleMeta | undefined {
  if (!role) return undefined;
  return byValue.get(role);
}

export function roleLabel(role: AppRole | null | undefined): string {
  return roleMeta(role)?.label ?? "Unknown";
}

export function roleLevel(role: AppRole | null | undefined): number {
  return roleMeta(role)?.level ?? -1;
}

/** Every configured role, ordered by level from highest to lowest. */
export function allRoles(): RoleMeta[] {
  return sortRoles(catalog);
}

export function rolesForDepartment(department: string): RoleMeta[] {
  return allRoles().filter((r) => r.department === department);
}

/** Levels 5-9 reach the admin dashboard. */
export function isAdminLevel(level: number): boolean {
  return level >= 5;
}

/** Levels 7-9 are Management and oversee every department. */
export function isManagementLevel(level: number): boolean {
  return level >= 7;
}

/** Only the Director (level 9) may reset the system. */
export function isDirectorLevel(level: number): boolean {
  return level >= 9;
}

/** Only the Director (level 9) configures outlets, stations, departments and roles. */
export function canConfigureLevel(level: number): boolean {
  return level >= 9;
}

/** Level 8 (Admin) and above may edit any section or document, whoever owns it. */
export function canEditAllContentLevel(level: number): boolean {
  return level >= 8;
}

/**
 * HR (Editor, level 7) and above may edit documents. HR is limited to the
 * sections assigned to them, which is also all they can see.
 */
export function canEditDocumentsLevel(level: number): boolean {
  return level >= 7;
}

/** Only Director (9) and Admin (8) reach the Staffs page. */
export function canViewStaffLevel(level: number): boolean {
  return level >= 8;
}

/** Only the Director (level 9) reads the audit log. */
export function canViewAuditLevel(level: number): boolean {
  return level >= 9;
}

/** Director (9) and Admin (8) manage staff within the hierarchy rules. */
export function canEditStaffLevel(level: number): boolean {
  return level >= 8;
}

/**
 * Hierarchy check: the actor must be a manager, rank at or above the target,
 * and oversee the target's department. Peers of the same level are allowed so
 * every role can hold more than one person.
 */
export function canManage(
  actor: { level: number; department: string },
  target: { level: number; department: string },
): boolean {
  if (!canEditStaffLevel(actor.level)) return false;
  if (actor.level < target.level) return false;
  // Director accounts can only be changed by a Director.
  if (target.level >= 9 && !isDirectorLevel(actor.level)) return false;
  if (isManagementLevel(actor.level)) return true;
  return actor.department === target.department;
}

export function departmentsManagedBy(actor: { level: number; department: string }): Department[] {
  if (!isAdminLevel(actor.level)) return [];
  if (isManagementLevel(actor.level)) return DEPARTMENTS;
  return [actor.department as Department];
}

/** Roles the actor is allowed to assign. Director is reserved for Directors only. */
export function assignableRoles(actor: {
  level: number;
  department: string;
  role?: AppRole | null;
}): RoleMeta[] {
  const departments = departmentsManagedBy(actor);
  return allRoles().filter((r) => {
    if (r.level > actor.level) return false;
    if (!departments.includes(r.department)) return false;
    if (r.value === "director" && actor.role !== "director") return false;
    return true;
  });
}
