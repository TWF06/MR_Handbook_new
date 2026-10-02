import type { SupabaseClient } from "@supabase/supabase-js";

import { canEditStaffLevel, canManage, roleLevel, roleLabel, type AppRole } from "./roles";
import { SEED_DOCUMENTS, SEED_SECTIONS, SEED_USERS } from "./seed-data";

export interface Actor {
  userId: string;
  employeeId: string;
  name: string;
  department: string;
  role: AppRole | null;
  level: number;
}

/** Reads the caller's own profile and role using their RLS-scoped client. */
export async function loadActor(
  supabase: SupabaseClient,
  userId: string,
): Promise<Actor> {
  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("profiles").select("employee_id, name, department, status").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role, is_primary").eq("user_id", userId),
  ]);

  if (profileError) throw new Error(profileError.message);
  if (rolesError) throw new Error(rolesError.message);
  if (!profile) throw new Error("Your employee profile could not be found.");
  if (profile.status !== "Active") throw new Error("Your account is disabled.");

  // The primary role decides the actor's level; extra roles are visibility-only.
  const rows = (roles ?? []) as { role: AppRole; is_primary: boolean }[];
  const highest = [...rows].sort((a, b) => roleLevel(b.role) - roleLevel(a.role))[0];
  const role = (rows.find((row) => row.is_primary)?.role ?? highest?.role ?? null) as AppRole | null;

  return {
    userId,
    employeeId: profile.employee_id,
    name: profile.name,
    department: profile.department,
    role,
    level: roleLevel(role),
  };
}

export function assertAdmin(actor: Actor) {
  if (actor.level < 5) throw new Error("You do not have administrative access.");
}

export function assertManagement(actor: Actor) {
  if (actor.level < 7) throw new Error("Only Management can perform this action.");
}

export function assertDirector(actor: Actor) {
  if (actor.role !== "director") throw new Error("Only the Director can reset the system database.");
}

export function assertCanAssignDirector(actor: Actor, roles: AppRole[]) {
  if (roles.includes("director") && actor.role !== "director") {
    throw new Error("Only a Director can assign the Director role.");
  }
}

export function assertCanManage(
  actor: Actor,
  target: { department: string; role: AppRole },
) {
  assertAdmin(actor);
  if (!canEditStaffLevel(actor.level)) {
    throw new Error("Only Director and Admin accounts can manage staff records.");
  }
  if (roleLevel(target.role) >= 9 && actor.level < 9) {
    throw new Error("Only a Director can manage a Director account.");
  }
  if (!canManage(actor, { level: roleLevel(target.role), department: target.department })) {
    throw new Error(
      `You cannot manage a ${roleLabel(target.role)} in ${target.department}. Managers can only manage lower-level employees in the departments they oversee.`,
    );
  }
}

export async function logAction(
  admin: SupabaseClient,
  actor: Actor,
  action: string,
): Promise<void> {
  await admin.from("audit_logs").insert({
    user_id: actor.employeeId,
    user_name: actor.name,
    action,
  });
}

/** Loads a target employee's profile and role with the service client. */
export async function loadTarget(admin: SupabaseClient, profileId: string) {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, employee_id, name, email, department, status")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Employee not found.");

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", profileId);
  return { ...profile, role: (roles?.[0]?.role ?? null) as AppRole | null };
}

/** Creates an auth user plus profile and role row. Idempotent by email. */
export async function createEmployee(
  admin: SupabaseClient,
  input: {
    employee_id: string;
    name: string;
    email: string;
    password: string;
    department: string;
    role: AppRole;
    status?: string;
    outlets?: string[];
    stations?: string[];
    departments?: string[];
    extra_roles?: AppRole[];
  },
): Promise<string> {
  const { data: created, error } = await (
    admin as unknown as {
      auth: {
        admin: {
          createUser: (args: Record<string, unknown>) => Promise<{
            data: { user: { id: string } | null };
            error: { message: string } | null;
          }>;
        };
      };
    }
  ).auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });

  if (error || !created?.user) {
    throw new Error(error?.message ?? "Could not create the account.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    employee_id: input.employee_id,
    name: input.name,
    email: input.email,
    department: input.department,
    status: input.status ?? "Active",
    outlets: input.outlets ?? ["Marco 1U", "Marco TGM", "Rebel Pasta"],
    stations: input.stations ?? [
      "Station 1",
      "Station 2",
      "Station 3",
      "Station 4",
      "Station 5",
    ],
    departments: input.departments ?? [],
  });

  if (profileError) {
    await deleteAuthUser(admin, userId);
    throw new Error(profileError.message);
  }

  try {
    await setRoles(admin, userId, input.role, input.extra_roles ?? []);
  } catch (error) {
    await deleteAuthUser(admin, userId);
    throw error;
  }

  return userId;
}

/** Replaces a user's roles: one primary role plus visibility-only extras. */
export async function setRoles(
  admin: SupabaseClient,
  userId: string,
  primary: AppRole,
  extras: AppRole[],
): Promise<void> {
  await admin.from("user_roles").delete().eq("user_id", userId);
  const rows = [
    { user_id: userId, role: primary, is_primary: true },
    ...extras
      .filter((role) => role !== primary)
      .map((role) => ({ user_id: userId, role, is_primary: false })),
  ];
  const { error } = await admin.from("user_roles").insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteAuthUser(admin: SupabaseClient, userId: string): Promise<void> {
  await (
    admin as unknown as {
      auth: { admin: { deleteUser: (id: string) => Promise<unknown> } };
    }
  ).auth.admin.deleteUser(userId);
}

export async function updateAuthUser(
  admin: SupabaseClient,
  userId: string,
  attrs: Record<string, unknown>,
): Promise<void> {
  const { error } = await (
    admin as unknown as {
      auth: {
        admin: {
          updateUserById: (
            id: string,
            attrs: Record<string, unknown>,
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  ).auth.admin.updateUserById(userId, attrs);
  if (error) throw new Error(error.message);
}

/** Restores the default sections and documents. */
export async function restoreHandbookSeeds(admin: SupabaseClient): Promise<void> {
  await admin.from("documents").delete().neq("id", "");
  await admin.from("sections").delete().neq("id", "");
  const { error: sectionError } = await admin.from("sections").insert(SEED_SECTIONS);
  if (sectionError) throw new Error(sectionError.message);
  const { error: docError } = await admin
    .from("documents")
    .insert(SEED_DOCUMENTS.map((doc) => ({ ...doc, last_updated: new Date().toISOString() })));
  if (docError) throw new Error(docError.message);
}

/** Creates any missing default employee accounts. */
export async function restoreDemoEmployees(admin: SupabaseClient): Promise<number> {
  const { data: existing } = await admin.from("profiles").select("employee_id");
  const present = new Set((existing ?? []).map((row) => row.employee_id as string));
  let created = 0;

  for (const user of SEED_USERS) {
    if (present.has(user.employee_id)) continue;
    try {
      await createEmployee(admin, user);
      created += 1;
    } catch {
      // Account already exists in auth but not in profiles: skip it.
    }
  }

  return created;
}

/**
 * Clears the FAQ board and audit trail and removes non-management, non-demo
 * accounts. Handbook sections and documents are kept as they are today, so a
 * reset returns to the current content version instead of the original seeds.
 */
export async function resetDatabase(admin: SupabaseClient, actor: Actor): Promise<void> {
  await admin.from("faq_replies").delete().neq("id", "");
  await admin.from("faq_threads").delete().neq("id", "");


  // Keep every demo account, the acting admin, and all Management staff.
  const seedIds = new Set(SEED_USERS.map((u) => u.employee_id));
  const { data: profiles } = await admin.from("profiles").select("id, employee_id, department");
  for (const profile of profiles ?? []) {
    const employeeId = profile.employee_id as string;
    if (seedIds.has(employeeId) || profile.id === actor.userId) continue;
    if (profile.department === "Management") continue;
    await deleteAuthUser(admin, profile.id as string);
  }

  await restoreDemoEmployees(admin);
  await admin.from("audit_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await logAction(admin, actor, "Reset the system to the current content version");
}
