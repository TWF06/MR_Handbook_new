import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SessionInfo } from "@/hooks/use-session";
import {
  createWorker,
  deleteWorker,
  resetWorkerPassword,
  updateWorker,
} from "@/lib/admin.functions";
import { TagPicker } from "@/components/admin/tag-picker";
import { formatDateTime } from "@/lib/time";
import { useOrgLists } from "@/lib/org-settings";
import { employeesQuery, type Employee } from "@/lib/queries";
import { ROLES, assignableRoles, canEditStaffLevel, canManage, departmentsManagedBy, roleLabel, roleLevel, type AppRole } from "@/lib/roles";

interface FormState {
  employee_id: string;
  name: string;
  email: string;
  password: string;
  department: string;
  role: AppRole | "";
  status: "Active" | "Disabled";
  outlets: string[];
  stations: string[];
  departments: string[];
  extraRoles: AppRole[];
}

const empty: FormState = {
  employee_id: "",
  name: "",
  email: "",
  password: "",
  department: "",
  role: "",
  status: "Active",
  outlets: [],
  stations: [],
  departments: [],
  extraRoles: [],
};

export function WorkersTab({ session, filter = "" }: { session: SessionInfo; filter?: string }) {
  const queryClient = useQueryClient();
  const { data: employees = [], isLoading } = useQuery(employeesQuery);

  const create = useServerFn(createWorker);
  const update = useServerFn(updateWorker);
  const remove = useServerFn(deleteWorker);
  const resetPassword = useServerFn(resetWorkerPassword);

  const [dialog, setDialog] = useState<"create" | "edit" | "password" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [newPassword, setNewPassword] = useState("");

  const orgLists = useOrgLists();
  const canEditStaff = canEditStaffLevel(session.level);
  const managed = departmentsManagedBy(session) as string[];
  const departments = orgLists.departments
    .map((entry) => entry.value)
    .filter((value) => managed.includes(value));
  const roleOptions = assignableRoles(session).filter((role) =>
    form.department ? role.department === form.department : true,
  );

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.role) throw new Error("Choose a primary role.");
      if (!form.department) throw new Error("Choose a department.");
      if (form.outlets.length === 0) throw new Error("Assign at least one outlet.");
      if (form.stations.length === 0) throw new Error("Assign at least one station.");
      if (dialog === "create") {
        await create({
          data: {
            employee_id: form.employee_id.trim(),
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            department: form.department,
            role: form.role,
            status: form.status,
            outlets: form.outlets,
            stations: form.stations,
            departments: form.departments,
            extra_roles: form.extraRoles,
          },
        });
      } else if (editingId) {
        await update({
          data: {
            id: editingId,
            name: form.name.trim(),
            email: form.email.trim(),
            department: form.department,
            role: form.role,
            status: form.status,
            outlets: form.outlets,
            stations: form.stations,
            departments: form.departments,
            extra_roles: form.extraRoles,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(dialog === "create" ? "Employee registered" : "Employee updated");
      setDialog(null);
      setForm(empty);
      setEditingId(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("No employee selected.");
      await resetPassword({ data: { id: editingId, password: newPassword } });
    },
    onSuccess: () => {
      toast.success("Password reset");
      setDialog(null);
      setNewPassword("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await remove({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Employee deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const term = filter.trim().toLowerCase();
  const visible = employees
    .filter(
      (worker) =>
        !term ||
        worker.name.toLowerCase().includes(term) ||
        worker.employee_id.toLowerCase().includes(term) ||
        worker.email.toLowerCase().includes(term) ||
        worker.department.toLowerCase().includes(term) ||
        (worker.roles ?? [])
          .map((role) => `${role} ${roleLabel(role)}`)
          .join(" ")
          .toLowerCase()
          .includes(term) ||
        roleLabel(worker.role).toLowerCase().includes(term) ||
        (worker.departments ?? []).join(" ").toLowerCase().includes(term) ||
        worker.outlets.join(" ").toLowerCase().includes(term) ||
        worker.stations.join(" ").toLowerCase().includes(term),
    )
    .slice()
    .sort(
      (a, b) =>
        roleLevel(b.role) - roleLevel(a.role) || a.name.localeCompare(b.name),
    );

  function manageable(worker: Employee) {
    if (!canEditStaff) return false;
    return canManage(session, {
      level: roleLevel(worker.role),
      department: worker.department,
    });
  }

  function openEdit(worker: Employee) {
    setEditingId(worker.id);
    setForm({
      employee_id: worker.employee_id,
      name: worker.name,
      email: worker.email,
      password: "",
      department: worker.department,
      role: worker.role ?? "",
      status: worker.status === "Disabled" ? "Disabled" : "Active",
      outlets: worker.outlets ?? [],
      stations: worker.stations ?? [],
      departments: worker.departments ?? [],
      extraRoles: (worker.roles ?? []).filter((role) => role !== worker.role),
    });
    setDialog("edit");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {!canEditStaff ? (
          <p className="mr-auto text-sm text-muted-foreground">
            View only — Admin accounts can see staff records but cannot change them.
          </p>
        ) : null}
        {canEditStaff ? (
        <Button
          onClick={() => {
            setForm({
              ...empty,
              department: departments[0] ?? "",
              outlets: orgLists.outlets.map((entry) => entry.value),
              stations: orgLists.stations.map((entry) => entry.value),
            });
            setEditingId(null);
            setDialog("create");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Register employee
        </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card panel-shadow">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Outlets · Stations</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  Loading employees…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  No employees match your search.
                </td>
              </tr>
            ) : (
              visible.map((worker) => (
                <tr key={worker.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-card-foreground">{worker.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {worker.employee_id} · {worker.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{roleLabel(worker.role)}</Badge>
                      {(worker.roles ?? [])
                        .filter((role) => role !== worker.role)
                        .map((role) => (
                          <Badge key={role} variant="outline">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[worker.department, ...(worker.departments ?? [])].join(", ")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <p>{(worker.outlets ?? []).join(", ") || "—"}</p>
                    <p>{(worker.stations ?? []).join(", ") || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        worker.status === "Active"
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {worker.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {worker.last_login_at
                        ? `Last login ${formatDateTime(worker.last_login_at)}`
                        : "Never signed in"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {manageable(worker) ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${worker.name}`}
                            onClick={() => openEdit(worker)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Reset password for ${worker.name}`}
                            onClick={() => {
                              setEditingId(worker.id);
                              setNewPassword("");
                              setDialog("password");
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${worker.name}`}
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete ${worker.name}? This cannot be undone.`)) {
                                deleteMutation.mutate(worker.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Read only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={dialog === "create" || dialog === "edit"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? "Register employee" : "Edit employee"}
            </DialogTitle>
            <DialogDescription>
              You can only assign roles below your own level, within the departments you oversee.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            {dialog === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input
                  id="employee_id"
                  required
                  maxLength={50}
                  value={form.employee_id}
                  onChange={(event) => setForm({ ...form, employee_id: event.target.value })}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                maxLength={255}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={255}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>

            {dialog === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input
                  id="password"
                  type="text"
                  required
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.department}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      department: value,
                      role: "",
                      departments: form.departments.filter((entry) => entry !== value),
                      extraRoles: form.extraRoles.filter((role) =>
                        [value, ...form.departments].includes(
                          ROLES.find((entry) => entry.value === role)?.department ?? "",
                        ),
                      ),
                    })
                  }

                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm({ ...form, role: value as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label} (L{role.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TagPicker
              label="Outlets"
              hint="At least one"
              options={orgLists.outlets}
              selected={form.outlets}
              onChange={(outlets) => setForm({ ...form, outlets })}
            />

            <TagPicker
              label="Stations"
              hint="At least one"
              options={orgLists.stations}
              selected={form.stations}
              onChange={(stations) => setForm({ ...form, stations })}
            />

            <TagPicker
              label="Additional departments"
              hint="Optional"
              options={departments
                .filter((department) => department !== form.department)
                .map((department) => ({ value: department, label: department }))}
              selected={form.departments}
              onChange={(values) => setForm({ ...form, departments: values })}
            />

            <TagPicker
              label="Additional roles"
              hint="Visibility only · limited to the departments assigned above"
              options={assignableRoles(session)
                .filter(
                  (role) =>
                    role.value !== form.role &&
                    (form.department
                      ? [form.department, ...form.departments].includes(role.department)
                      : true),
                )
                .map((role) => ({ value: role.value, label: role.label }))}
              selected={form.extraRoles}
              onChange={(values) => setForm({ ...form, extraRoles: values as AppRole[] })}
            />


            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm({ ...form, status: value as "Active" | "Disabled" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "password"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a temporary password and share it with the employee securely.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              passwordMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                required
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? "Saving…" : "Reset password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
