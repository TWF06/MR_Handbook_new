import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Roles are configurable in the System settings page, so they are validated as
// keys rather than a fixed enum. The database enum rejects unknown values.
const roleEnum = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]*$/, "Invalid role.");

// Outlets, stations and departments are configurable in the System settings page.
const nameSchema = z.string().trim().min(1).max(120);
const outletsSchema = z.array(nameSchema).default([]);
const stationsSchema = z.array(nameSchema).default([]);
const departmentsSchema = z.array(nameSchema).default([]);
const extraRolesSchema = z.array(roleEnum).default([]);

const workerSchema = z.object({
  employee_id: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  department: nameSchema,
  role: roleEnum,
  status: z.enum(["Active", "Disabled"]).default("Active"),
  outlets: outletsSchema,
  stations: stationsSchema,
  departments: departmentsSchema,
  extra_roles: extraRolesSchema,
});

export const createWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => workerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const helpers = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const actor = await helpers.loadActor(context.supabase, context.userId);
    helpers.assertCanManage(actor, { department: data.department, role: data.role });
    helpers.assertCanAssignDirector(actor, [data.role, ...data.extra_roles]);

    await helpers.createEmployee(supabaseAdmin, data);
    await helpers.logAction(
      supabaseAdmin,
      actor,
      `Registered employee ${data.name} (${data.employee_id}) as ${data.role} in ${data.department}`,
    );

    return { ok: true };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  department: nameSchema,
  role: roleEnum,
  status: z.enum(["Active", "Disabled"]),
  outlets: outletsSchema,
  stations: stationsSchema,
  departments: departmentsSchema,
  extra_roles: extraRolesSchema,
});

export const updateWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const helpers = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const actor = await helpers.loadActor(context.supabase, context.userId);
    const target = await helpers.loadTarget(supabaseAdmin, data.id);
    if (!target.role) throw new Error("That employee has no role assigned.");

    // Must outrank both the current and the requested role/department.
    helpers.assertCanManage(actor, { department: target.department, role: target.role });
    helpers.assertCanManage(actor, { department: data.department, role: data.role });
    helpers.assertCanAssignDirector(actor, [data.role, ...data.extra_roles]);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        name: data.name,
        email: data.email,
        department: data.department,
        status: data.status,
        outlets: data.outlets,
        stations: data.stations,
        departments: data.departments,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.email !== target.email) {
      await helpers.updateAuthUser(supabaseAdmin, data.id, { email: data.email, email_confirm: true });
    }

    await helpers.setRoles(supabaseAdmin, data.id, data.role, data.extra_roles);

    await helpers.logAction(
      supabaseAdmin,
      actor,
      `Updated employee ${data.name} (${target.employee_id}): ${data.role} in ${data.department}, status ${data.status}`,
    );

    return { ok: true };
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const helpers = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const actor = await helpers.loadActor(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("You cannot delete your own account.");

    const target = await helpers.loadTarget(supabaseAdmin, data.id);
    if (!target.role) throw new Error("That employee has no role assigned.");
    helpers.assertCanManage(actor, { department: target.department, role: target.role });

    await helpers.deleteAuthUser(supabaseAdmin, data.id);
    await helpers.logAction(
      supabaseAdmin,
      actor,
      `Deleted employee ${target.name} (${target.employee_id})`,
    );

    return { ok: true };
  });

export const resetWorkerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const helpers = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const actor = await helpers.loadActor(context.supabase, context.userId);
    const target = await helpers.loadTarget(supabaseAdmin, data.id);
    if (!target.role) throw new Error("That employee has no role assigned.");
    helpers.assertCanManage(actor, { department: target.department, role: target.role });

    await helpers.updateAuthUser(supabaseAdmin, data.id, { password: data.password });
    await helpers.logAction(
      supabaseAdmin,
      actor,
      `Reset the password for ${target.name} (${target.employee_id})`,
    );

    return { ok: true };
  });

// The create_app_role database function is SECURITY DEFINER and not callable by
// signed-in users directly; role creation goes through here so the Director
// check runs before the service role executes it.
export const createRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        value: roleEnum,
        label: nameSchema,
        level: z.number().int().min(0).max(9),
        department: nameSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const helpers = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const actor = await helpers.loadActor(context.supabase, context.userId);
    helpers.assertDirector(actor);

    const { error } = await supabaseAdmin.rpc("create_app_role", {
      _value: data.value,
      _label: data.label,
      _level: data.level,
      _department: data.department,
    });
    if (error) throw new Error(error.message);

    await helpers.logAction(
      supabaseAdmin,
      actor,
      `Added role "${data.label}" (L${data.level}, ${data.department})`,
    );

    return { ok: true };
  });

export const resetSystemDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const helpers = await import("./admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const actor = await helpers.loadActor(context.supabase, context.userId);
    helpers.assertDirector(actor);
    await helpers.resetDatabase(supabaseAdmin, actor);

    return { ok: true };
  });

/**
 * One-time bootstrap of the demo accounts. Refuses to run once any employee
 * profile exists, so it cannot be used to inject accounts later.
 */
export const bootstrapDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const helpers = await import("./admin.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("employee_id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return { created: 0, alreadyInitialised: true };

  const created = await helpers.restoreDemoEmployees(supabaseAdmin);
  return { created, alreadyInitialised: false };
});
