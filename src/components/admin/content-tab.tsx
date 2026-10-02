import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { SessionInfo } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { renderMarkdown } from "@/lib/markdown";
import {
  documentsQuery,
  librariesQuery,
  newId,
  recordAudit,
  sectionsQuery,
  type HandbookDocument,
  type Section,
} from "@/lib/queries";
import {
  canEditAllContentLevel,
  canEditDocumentsLevel,
  roleLabel,
  type AppRole,
} from "@/lib/roles";
import { TagPicker } from "@/components/admin/tag-picker";
import { audienceTags, stationTags } from "@/lib/org";
import { useOrgLists } from "@/lib/org-settings";
import { formatDate } from "@/lib/time";

/** Shift every row at or after `from` one place backward so the new item slots in. */
async function shiftSections(rows: Section[], from: number) {
  const affected = rows
    .filter((row) => row.order_num >= from)
    .sort((a, b) => b.order_num - a.order_num);
  for (const row of affected) {
    const { error } = await supabase
      .from("sections")
      .update({ order_num: row.order_num + 1 })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }
}

async function shiftDocuments(rows: HandbookDocument[], from: number) {
  const affected = rows
    .filter((row) => row.order_num >= from)
    .sort((a, b) => b.order_num - a.order_num);
  for (const row of affected) {
    const { error } = await supabase
      .from("documents")
      .update({ order_num: row.order_num + 1 })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }
}

/** Renumber sections 1..n so gaps left by deletes disappear. */
const LIBRARY_STORAGE_KEY = "admin-library-id";

/** Remembers the chosen admin library across tabs and reloads (per browser). */
function useRememberedLibrary(): [string, (value: string) => void] {
  const [libraryId, setLibraryId] = useState(() => {
    if (typeof window === "undefined") return "handbook";
    return window.localStorage.getItem(LIBRARY_STORAGE_KEY) ?? "handbook";
  });
  const select = useCallback((value: string) => {
    setLibraryId(value);
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, value);
  }, []);
  return [libraryId, select];
}

async function resequenceSections(libraryId: string) {
  const { data, error } = await supabase
    .from("sections")
    .select("id, order_num, title")
    .eq("library_id", libraryId)
    .order("order_num", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  for (const [index, row] of (data ?? []).entries()) {
    if (row.order_num === index + 1) continue;
    const { error: updateError } = await supabase
      .from("sections")
      .update({ order_num: index + 1 })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
  }
}

/** Renumber documents 1..n inside every section. */
async function resequenceDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("id, order_num, section_id, title")
    .order("order_num", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  const counters = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.section_id ?? "";
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    if (row.order_num === next) continue;
    const { error: updateError } = await supabase
      .from("documents")
      .update({ order_num: next })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
  }
}

/** Level 8+ may change anything; other admins only their own uploads. */
function canEditOwned(session: SessionInfo, createdBy: string | null | undefined): boolean {
  if (canEditAllContentLevel(session.level)) return true;
  return Boolean(createdBy) && createdBy === session.employeeId;
}

/**
 * Documents: level 8+ edits everything, HR (level 7) edits documents in the
 * sections assigned to them (all they can see), others only their own uploads.
 */
function canEditDocument(session: SessionInfo, createdBy: string | null | undefined): boolean {
  if (canEditDocumentsLevel(session.level)) return true;
  return canEditOwned(session, createdBy);
}

export function SectionsPanel({
  session,
  filter = "",
}: {
  session: SessionInfo;
  filter?: string;
}) {
  const queryClient = useQueryClient();
  const { data: allSections = [] } = useQuery(sectionsQuery);
  const { data: documents = [] } = useQuery(documentsQuery);
  const { data: libraries = [] } = useQuery(librariesQuery);
  const orgLists = useOrgLists();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [title, setTitle] = useState("");
  const [stations, setStations] = useState<string[]>([]);
  const [order, setOrder] = useState("1");
  const [libraryId, setLibraryId] = useRememberedLibrary();

  const activeLibrary = libraries.find((item) => item.id === libraryId) ?? libraries[0];
  const activeLibraryId = activeLibrary?.id ?? "handbook";
  const sections = allSections.filter((section) => section.library_id === activeLibraryId);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["sections"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const clean = title.trim();
      if (clean.length < 2) throw new Error("Give the section a title.");
      const payload = {
        title: clean,
        target_stations: stations,
        order_num: Number(order) || 1,
      };

      if (editing) {
        const { error } = await supabase.from("sections").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
        await resequenceSections(editing.library_id);
        await recordAudit(session.employeeId, session.name, `Updated section "${clean}"`);
      } else {
        await shiftSections(sections, payload.order_num);
        const { error } = await supabase.from("sections").insert({
          id: newId("sec"),
          created_by: session.employeeId,
          library_id: activeLibraryId,
          ...payload,
        });
        if (error) throw new Error(error.message);
        await resequenceSections(activeLibraryId);
        await recordAudit(
          session.employeeId,
          session.name,
          `Created section "${clean}" in ${activeLibrary?.title ?? "Handbook"}`,
        );
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Section updated" : "Section created");
      setOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (section: Section) => {
      const { error } = await supabase.from("sections").delete().eq("id", section.id);
      if (error) throw new Error(error.message);
      await resequenceSections(section.library_id);
      await resequenceDocuments();
      await recordAudit(session.employeeId, session.name, `Deleted section "${section.title}"`);
    },
    onSuccess: () => {
      toast.success("Section deleted");
      refresh();
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Label htmlFor="sections-library">Library</Label>
          <Select value={activeLibraryId} onValueChange={setLibraryId}>
            <SelectTrigger id="sections-library" className="w-56">
              <SelectValue placeholder="Library" />
            </SelectTrigger>
            <SelectContent>
              {libraries.map((library) => (
                <SelectItem key={library.id} value={library.id}>
                  {library.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setTitle("");
            setStations([]);
            setOrder("1");
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> New section
        </Button>
      </div>

      <ul className="space-y-2">
        {sections
          .filter((section) =>
            filter.trim()
              ? `${section.title} ${(section.target_stations ?? []).join(" ")}`
                  .toLowerCase()
                  .includes(filter.trim().toLowerCase())
              : true,
          )
          .map((section) => (
          <li
            key={section.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 panel-shadow"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
              {section.order_num}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-card-foreground">{section.title}</p>
              <p className="text-xs text-muted-foreground">
                {documents.filter((doc) => doc.section_id === section.id).length} documents
              </p>
            </div>
            {stationTags(section.target_stations).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
            {canEditOwned(session, section.created_by) ? (
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${section.title}`}
                  onClick={() => {
                    setEditing(section);
                    setTitle(section.title);
                    setStations(section.target_stations ?? []);
                    setOrder(String(section.order_num));
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${section.title}`}
                  onClick={() => {
                    if (window.confirm(`Delete "${section.title}" and detach its documents?`)) {
                      remove.mutate(section);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <Badge variant="secondary" className="font-normal">
                Read only
              </Badge>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit section" : "New section"}</DialogTitle>
            <DialogDescription>
              Stations control who can see this section. Leave stations empty to share it with
              everyone in the library.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="section-title">Title</Label>
              <Input
                id="section-title"
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <TagPicker
              label="Stations"
              hint="Empty = all stations"
              options={orgLists.stations}
              selected={stations}
              onChange={setStations}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="section-order">Order</Label>
                <Input
                  id="section-order"
                  type="number"
                  min={1}
                  value={order}
                  onChange={(event) => setOrder(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save section"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DocumentsPanel({
  session,
  filter = "",
}: {
  session: SessionInfo;
  filter?: string;
}) {
  const queryClient = useQueryClient();
  const { data: allSections = [] } = useQuery(sectionsQuery);
  const { data: documents = [] } = useQuery(documentsQuery);
  const { data: libraries = [] } = useQuery(librariesQuery);
  const [libraryId, setLibraryId] = useRememberedLibrary();

  const activeLibrary = libraries.find((item) => item.id === libraryId) ?? libraries[0];
  const activeLibraryId = activeLibrary?.id ?? "handbook";
  const sections = useMemo(
    () => allSections.filter((section) => section.library_id === activeLibraryId),
    [allSections, activeLibraryId],
  );

  const orgLists = useOrgLists();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HandbookDocument | null>(null);
  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [order, setOrder] = useState("1");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const previewHtml = useMemo(() => renderMarkdown(content), [content]);

  // Sections are no longer tied to a department, so every role is offered here.
  const roleOptions = orgLists.roles;

  const term = filter.trim().toLowerCase();
  const matchesFilter = useCallback(
    (doc: HandbookDocument) => {
      if (!term) return true;
      const sectionTitle = sections.find((s) => s.id === doc.section_id)?.title ?? "";
      const haystack = [
        doc.title,
        sectionTitle,
        ...audienceTags(doc),
        ...(doc.target_roles ?? []),
        ...(doc.target_roles ?? []).map((role) => roleLabel(role)),
        (doc.target_roles ?? []).length === 0 ? "all roles" : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    },
    [term, sections],
  );

  /** Documents grouped under their section, ordered by section then document order. */
  const groups = useMemo(() => {
    const sorted = [...sections].sort((a, b) => a.order_num - b.order_num);
    const byOrder = (a: HandbookDocument, b: HandbookDocument) =>
      a.order_num - b.order_num || a.title.localeCompare(b.title);

    const result = sorted
      .map((section) => ({
        key: section.id,
        title: section.title,
        stations: stationTags(section.target_stations),
        docs: documents
          .filter((doc) => doc.section_id === section.id && matchesFilter(doc))
          .sort(byOrder),
      }))
      .filter((group) => (term ? group.docs.length > 0 : true));

    const orphans = documents
      .filter(
        (doc) =>
          !allSections.some((section) => section.id === doc.section_id) && matchesFilter(doc),
      )
      .sort(byOrder);
    if (orphans.length > 0) {
      result.push({ key: "__unassigned", title: "Unassigned", stations: [], docs: orphans });
    }
    return result;
  }, [sections, allSections, documents, matchesFilter, term]);


  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim();
      if (cleanTitle.length < 2) throw new Error("Give the document a title.");
      if (!sectionId) throw new Error("Choose a section.");
      if (!content.trim()) throw new Error("Add some content.");

      const payload = {
        title: cleanTitle,
        section_id: sectionId,
        order_num: Number(order) || 1,
        content,
        last_updated: new Date().toISOString(),
        // Roles are configurable, so the generated enum type is widened here.
        target_roles: roles as never[],
      };

      if (editing) {
        const { error } = await supabase.from("documents").update(payload).eq("id", editing.id);
        if (error) throw new Error(error.message);
        await resequenceDocuments();
        await recordAudit(session.employeeId, session.name, `Updated document "${cleanTitle}"`);
      } else {
        await shiftDocuments(
          documents.filter((doc) => doc.section_id === sectionId),
          payload.order_num,
        );
        const { error } = await supabase
          .from("documents")
          .insert({ id: newId("doc"), created_by: session.employeeId, ...payload });
        if (error) throw new Error(error.message);
        await resequenceDocuments();
        await recordAudit(session.employeeId, session.name, `Published document "${cleanTitle}"`);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Document updated" : "Document published");
      setOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (doc: HandbookDocument) => {
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw new Error(error.message);
      await resequenceDocuments();
      await recordAudit(session.employeeId, session.name, `Deleted document "${doc.title}"`);
    },
    onSuccess: () => {
      toast.success("Document deleted");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function onUpload(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setContent(text);
    if (!title.trim()) setTitle(file.name.replace(/\.(md|markdown|txt)$/i, ""));
    toast.success("Markdown loaded into the editor");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Label htmlFor="documents-library">Library</Label>
          <Select value={activeLibraryId} onValueChange={setLibraryId}>
            <SelectTrigger id="documents-library" className="w-56">
              <SelectValue placeholder="Library" />
            </SelectTrigger>
            <SelectContent>
              {libraries.map((library) => (
                <SelectItem key={library.id} value={library.id}>
                  {library.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setTitle("");
            setSectionId(sections[0]?.id ?? "");
            setOrder("1");
            setContent("");
            setPreview(false);
            setRoles([]);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> New document
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground panel-shadow">
          {term ? "No documents found." : "No documents yet."}
        </p>

      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.key}
              className="overflow-hidden rounded-2xl border border-border bg-card panel-shadow"
            >
              <header className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
                <h3 className="text-sm font-semibold text-card-foreground">{group.title}</h3>
                {group.stations.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.docs.length} document{group.docs.length === 1 ? "" : "s"}
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 w-12">#</th>
                      <th className="px-4 py-2">Document</th>
                      <th className="px-4 py-2">Who can see it</th>
                      <th className="px-4 py-2">Updated</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.docs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-muted-foreground">
                          {term ? "No documents found." : "No documents in this section yet."}
                        </td>
                      </tr>
                    ) : (
                      group.docs.map((doc) => (
                        <tr key={doc.id}>
                          <td className="px-4 py-3 text-muted-foreground">{doc.order_num}</td>
                          <td className="px-4 py-3 font-medium text-card-foreground">{doc.title}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {audienceTags(doc).map((tag) => (
                                <Badge key={tag} variant="outline" className="font-normal">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(doc.last_updated)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {canEditDocument(session, doc.created_by) ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Edit ${doc.title}`}
                                    onClick={() => {
                                      setEditing(doc);
                                      setTitle(doc.title);
                                      setSectionId(doc.section_id ?? "");
                                      setOrder(String(doc.order_num));
                                      setContent(doc.content);
                                      setPreview(false);
                                      setRoles(doc.target_roles ?? []);
                                      setOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Delete ${doc.title}`}
                                    onClick={() => {
                                      if (window.confirm(`Delete "${doc.title}"?`)) remove.mutate(doc);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="secondary" className="font-normal">
                                  Read only
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit document" : "New document"}</DialogTitle>
            <DialogDescription>
              Write Markdown or upload a .md file. Headings become table-of-contents entries.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="doc-title">Title</Label>
                <Input
                  id="doc-title"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="doc-order">Order</Label>
                <Input
                  id="doc-order"
                  type="number"
                  min={1}
                  value={order}
                  onChange={(event) => setOrder(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-file">Upload Markdown</Label>
                <Input
                  id="doc-file"
                  type="file"
                  accept=".md,.markdown,.txt"
                  onChange={(event) => onUpload(event.target.files?.[0])}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold text-card-foreground">Audience</p>
              <p className="text-xs text-muted-foreground">
                Roles decide who can open this document. Its section already limits which stations
                see it, and the library limits which departments.
              </p>
              <TagPicker
                label="Roles"
                hint="Empty = every role that can see the section"
                options={roleOptions.map((role) => ({ value: role.value, label: role.label }))}
                selected={roles}
                onChange={(values) => setRoles(values as AppRole[])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="doc-content">Content</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreview((value) => !value)}
                >
                  <Eye className="mr-1.5 h-4 w-4" /> {preview ? "Edit" : "Preview"}
                </Button>
              </div>
              {preview ? (
                <div
                  className="doc-prose max-h-72 overflow-y-auto rounded-xl border border-border bg-background p-4"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <Textarea
                  id="doc-content"
                  rows={14}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="font-mono text-xs"
                  placeholder="# Heading\n\nWrite your procedure…"
                />
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
