import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useOrgLists, type OrgKind, type OrgSetting } from "@/lib/org-settings";
import { departmentTags } from "@/lib/org";
import { librariesQuery, recordAudit, sectionsQuery } from "@/lib/queries";
import { createRole } from "@/lib/admin.functions";
import { TagPicker } from "@/components/admin/tag-picker";

const KIND_LABELS: Record<OrgKind, string> = {
  outlet: "Outlets",
  station: "Stations",
  department: "Departments",
  role: "Roles",
};

interface ListProps {
  kind: OrgKind;
  rows: OrgSetting[];
  departments: { value: string; label: string }[];
  session: SessionInfo;
  canRename: boolean;
  canStructure: boolean;
  onChanged: () => void;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function OrgList({
  kind,
  rows,
  departments,
  session,
  canRename,
  canStructure,
  onChanged,
}: ListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newValue, setNewValue] = useState("");
  const [draftLevel, setDraftLevel] = useState("0");
  const [newLevel, setNewLevel] = useState("1");
  const [newDepartment, setNewDepartment] = useState(departments[0]?.value ?? "Management");

  // Roles read top-down by level; the other lists keep their configured order.
  const visibleRows =
    kind === "role"
      ? [...rows].sort((a, b) => b.order_num - a.order_num || a.label.localeCompare(b.label))
      : rows;

  const rename = useMutation({
    mutationFn: async ({ row, label, level }: { row: OrgSetting; label: string; level?: number }) => {
      const clean = label.trim();
      if (clean.length < 1) throw new Error("Give it a name.");
      const patch: { label: string; order_num?: number } = { label: clean };
      if (kind === "role") {
        if (level === undefined || Number.isNaN(level) || level < 0 || level > 9) {
          throw new Error("Level must be between 0 and 9.");
        }
        patch.order_num = level;
      }
      const { error } = await supabase.from("org_settings").update(patch).eq("id", row.id);
      if (error) throw new Error(error.message);
      await recordAudit(
        session.employeeId,
        session.name,
        kind === "role"
          ? `Updated role "${row.label}" to "${clean}" (L${level})`
          : `Renamed ${kind} "${row.label}" to "${clean}"`,
      );
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success("Renamed");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const add = useMutation({
    mutationFn: async (input: {
      value: string;
      label: string;
      level?: number;
      department?: string;
    }) => {
      if (!input.value) throw new Error("Give it a name.");
      if (rows.some((row) => row.value === input.value)) throw new Error("That already exists.");
      if (kind === "role") {
        const level = input.level ?? NaN;
        if (Number.isNaN(level) || level < 0 || level > 9) {
          throw new Error("Level must be between 0 and 9.");
        }
        await createRole({
          data: {
            value: input.value,
            label: input.label,
            level,
            department: input.department ?? "Management",
          },
        });
        return;
      }
      const { error } = await supabase.from("org_settings").insert({
        kind,
        value: input.value,
        label: input.label,
        order_num: rows.length + 1,
      });
      if (error) throw new Error(error.message);
      await recordAudit(session.employeeId, session.name, `Added ${kind} "${input.label}"`);
    },
    onSuccess: () => {
      setNewValue("");
      toast.success("Added");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (row: OrgSetting) => {
      const { error } = await supabase.from("org_settings").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      await recordAudit(session.employeeId, session.name, `Removed ${kind} "${row.label}"`);
    },
    onSuccess: () => {
      toast.success("Removed");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 panel-shadow">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {KIND_LABELS[kind]}
      </h3>

      <ul className="mt-4 space-y-2">
        {visibleRows.length === 0 ? (
          <li className="text-sm text-muted-foreground">Nothing configured yet.</li>
        ) : (
          visibleRows.map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              {editingId === row.id ? (
                <>
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="h-9"
                    aria-label={`Rename ${row.label}`}
                  />
                  {kind === "role" ? (
                    <Input
                      type="number"
                      min={0}
                      max={9}
                      value={draftLevel}
                      onChange={(event) => setDraftLevel(event.target.value)}
                      className="h-9 w-20"
                      aria-label={`Level for ${row.label}`}
                    />
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Save name"
                    disabled={rename.isPending}
                    onClick={() =>
                      rename.mutate({ row, label: draft, level: Number(draftLevel) })
                    }
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Cancel"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  {kind === "role" ? (
                    <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      L{row.order_num}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm text-card-foreground">
                    {row.label}
                    {kind === "role" && row.department ? (
                      <span className="ml-2 text-xs text-muted-foreground">{row.department}</span>
                    ) : null}
                    {kind !== "role" && row.label !== row.value ? (
                      <span className="ml-2 text-xs text-muted-foreground">({row.value})</span>
                    ) : null}
                  </span>
                  {canRename ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(row.id);
                        setDraft(row.label);
                        setDraftLevel(String(row.order_num));
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {canStructure ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${row.label}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove ${row.label}?`)) remove.mutate(row);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </>
              )}
            </li>
          ))
        )}
      </ul>

      {canStructure ? (
        <form
          className="mt-auto flex flex-wrap items-end gap-2 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const label = newValue.trim();
            if (!label) {
              toast.error(`Give the ${kind} a name.`);
              return;
            }
            if (kind === "role") {
              add.mutate({
                value: slugify(label),
                label,
                level: Number(newLevel),
                department: newDepartment,
              });
              return;
            }
            add.mutate({ value: label || slugify(label), label });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`add-${kind}`} className="text-xs">
              Add {kind}
            </Label>
            <Input
              id={`add-${kind}`}
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              placeholder={`New ${kind} name`}
              className="w-56"
            />
          </div>
          {kind === "role" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="add-role-level" className="text-xs">
                  Level (0-9)
                </Label>
                <Input
                  id="add-role-level"
                  type="number"
                  min={0}
                  max={9}
                  value={newLevel}
                  onChange={(event) => setNewLevel(event.target.value)}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-role-department" className="text-xs">
                  Department
                </Label>
                <Select value={newDepartment} onValueChange={setNewDepartment}>
                  <SelectTrigger id="add-role-department" className="w-40">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.value} value={department.value}>
                        {department.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
          <Button type="submit" variant="outline" disabled={add.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </form>
      ) : null}
    </section>
  );
}

/** Director-only management of document libraries (separate trees of sections). */
function LibrariesCard({ session }: { session: SessionInfo }) {
  const queryClient = useQueryClient();
  const { data: libraries = [] } = useQuery(librariesQuery);
  const { data: sections = [] } = useQuery(sectionsQuery);
  const { departments } = useOrgLists();
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftDepartments, setDraftDepartments] = useState<string[]>([]);


  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["libraries"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  }

  const add = useMutation({
    mutationFn: async (title: string) => {
      const clean = title.trim();
      if (clean.length < 2) throw new Error("Give the library a name.");
      const slug = slugify(clean).replace(/_/g, "-");
      if (!slug) throw new Error("Use letters or numbers in the name.");
      if (libraries.some((library) => library.slug === slug)) {
        throw new Error("A library with that name already exists.");
      }
      const { error } = await supabase.from("libraries").insert({
        id: slug,
        slug,
        title: clean,
        order_num: libraries.length + 1,
        visibility: "staff",
      });
      if (error) throw new Error(error.message);
      await recordAudit(session.employeeId, session.name, `Created library "${clean}"`);
    },
    onSuccess: () => {
      setNewTitle("");
      toast.success("Library created");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rename = useMutation({
    mutationFn: async ({
      id,
      title,
      target_departments,
    }: {
      id: string;
      title: string;
      target_departments: string[];
    }) => {
      const clean = title.trim();
      if (clean.length < 2) throw new Error("Give the library a name.");
      const { error } = await supabase
        .from("libraries")
        .update({ title: clean, target_departments })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await recordAudit(session.employeeId, session.name, `Updated library "${clean}"`);
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success("Saved");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (library: { id: string; title: string }) => {
      if (sections.some((section) => section.library_id === library.id)) {
        throw new Error("Move or delete its sections first.");
      }
      const { error } = await supabase.from("libraries").delete().eq("id", library.id);
      if (error) throw new Error(error.message);
      await recordAudit(session.employeeId, session.name, `Removed library "${library.title}"`);
    },
    onSuccess: () => {
      toast.success("Removed");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 panel-shadow">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Document libraries
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Each library is its own tree of sections and documents. New libraries are staff-only; the
        Handbook stays the public one.
      </p>

      <ul className="mt-4 space-y-2">
        {libraries.map((library) => {
          const count = sections.filter((section) => section.library_id === library.id).length;
          return (
            <li key={library.id} className="rounded-xl border border-border p-3">
              {editingId === library.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="h-9"
                      aria-label={`Rename ${library.title}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Save library"
                      disabled={rename.isPending}
                      onClick={() =>
                        rename.mutate({
                          id: library.id,
                          title: draft,
                          target_departments: draftDepartments,
                        })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Cancel"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <TagPicker
                    label="Departments"
                    hint="Empty = everyone"
                    options={departments}
                    selected={draftDepartments}
                    onChange={setDraftDepartments}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-card-foreground">
                    {library.title}
                    <span className="ml-2 text-xs text-muted-foreground">
                      /{library.slug} · {count} section{count === 1 ? "" : "s"} ·{" "}
                      {library.visibility === "public" ? "public" : "staff only"} ·{" "}
                      {departmentTags(library.target_departments).join(", ")}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(library.id);
                      setDraft(library.title);
                      setDraftDepartments(library.target_departments ?? []);
                    }}
                  >
                    Edit
                  </Button>
                  {library.id === "handbook" ? null : (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${library.title}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Remove ${library.title}?`)) remove.mutate(library);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate(newTitle);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="add-library" className="text-xs">
            Add library
          </Label>
          <Input
            id="add-library"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="e.g. FOH Training"
            className="w-56"
          />
        </div>
        <Button type="submit" variant="outline" disabled={add.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </form>
    </section>
  );
}

/**
 * Outlet, station, department and role configuration. Level 8 and above may
 * rename anything and add or remove outlets and stations; only the Director
 * may add or remove departments and roles.
 */
export function SystemSettings({ session }: { session: SessionInfo }) {
  const queryClient = useQueryClient();
  const { settings, departments } = useOrgLists();

  const canRename = session.level >= 8;
  const isDirector = session.level >= 9;

  function onChanged() {
    queryClient.invalidateQueries({ queryKey: ["org_settings"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Organisation settings</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Rename, add or remove outlets, stations, departments and roles. Departments and roles can
          only be changed by a Director.
        </p>
      </div>

      <div className="grid min-h-[520px] grid-cols-1 grid-rows-2 items-stretch gap-4 lg:min-h-[600px] lg:grid-cols-2">
        {(["outlet", "station", "department", "role"] as OrgKind[]).map((kind) => {
          const structural = kind === "department" || kind === "role";
          return (
            <OrgList
              key={kind}
              kind={kind}
              rows={settings.filter((row) => row.kind === kind)}
              departments={departments}
              session={session}
              canRename={structural ? isDirector : canRename}
              canStructure={structural ? isDirector : canRename}
              onChanged={onChanged}
            />
          );
        })}

      </div>

      {isDirector ? <LibrariesCard session={session} /> : null}
    </div>
  );
}
