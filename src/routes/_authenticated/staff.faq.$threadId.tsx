import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Pin, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { newId, recordAudit, repliesQuery, threadsQuery } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/staff/faq/$threadId")({
  component: StaffThreadPage,
});

function StaffThreadPage() {
  const { threadId } = Route.useParams();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: threads = [] } = useQuery(threadsQuery);
  const { data: replies = [], isLoading } = useQuery(repliesQuery(threadId));
  const [content, setContent] = useState("");

  const thread = threads.find((item) => item.id === threadId);
  // Pinning replies and resolving threads is Management-only.
  const canModerate = Boolean(session?.isManagement);

  useEffect(() => {
    const channel = supabase
      .channel(`faq-thread-${threadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faq_replies" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faq_replies", threadId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "faq_threads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faq_threads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, threadId]);

  const reply = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("You are not signed in.");
      const clean = content.trim();
      if (clean.length < 2) throw new Error("Write a reply first.");
      if (clean.length > 4000) throw new Error("Replies must be under 4000 characters.");
      const { error } = await supabase.from("faq_replies").insert({
        id: newId("reply"),
        thread_id: threadId,
        author_id: session.employeeId,
        author_name: session.name,
        content: clean,
      });
      if (error) throw new Error(error.message);
      await recordAudit(
        session.employeeId,
        session.name,
        `Replied to FAQ thread "${thread?.title ?? threadId}"`,
      );
    },
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["faq_replies", threadId] });
      queryClient.invalidateQueries({ queryKey: ["faq_reply_counts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moderate = useMutation({
    mutationFn: async (patch: { resolved?: boolean; pinned_reply_id?: string | null }) => {
      if (!session) throw new Error("You are not signed in.");
      const { error } = await supabase.from("faq_threads").update(patch).eq("id", threadId);
      if (error) throw new Error(error.message);

      const label = thread?.title ?? threadId;
      const action =
        patch.resolved === true
          ? `Marked FAQ thread "${label}" as resolved`
          : patch.resolved === false
            ? `Reopened FAQ thread "${label}"`
            : patch.pinned_reply_id
              ? `Pinned an answer on FAQ thread "${label}"`
              : `Unpinned the answer on FAQ thread "${label}"`;
      await recordAudit(session.employeeId, session.name, action);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faq_threads"] });
      queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!thread) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Thread not found</h1>
        <Button asChild className="mt-6">
          <Link to="/staff/faq">Back to the board</Link>
        </Button>
      </div>
    );
  }

  const pinned = replies.find((item) => item.id === thread.pinned_reply_id);
  const rest = replies.filter((item) => item.id !== thread.pinned_reply_id);

  return (
    <div className="pane-fade mx-auto max-w-3xl">
      <Link
        to="/staff/faq"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> FAQ board
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{thread.title}</h1>
        {thread.resolved ? (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Resolved
          </Badge>
        ) : (
          <Badge variant="outline">Open</Badge>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Asked by {thread.author_name} · {formatDateTime(thread.created_at)}
      </p>

      {canModerate ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={thread.resolved ? "outline" : "default"}
            disabled={moderate.isPending}
            onClick={() => moderate.mutate({ resolved: !thread.resolved })}
          >
            {thread.resolved ? (
              <>
                <Undo2 className="mr-2 h-4 w-4" /> Reopen thread
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark resolved
              </>
            )}
          </Button>
          {thread.pinned_reply_id ? (
            <Button
              size="sm"
              variant="outline"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ pinned_reply_id: null })}
            >
              Unpin answer
            </Button>
          ) : null}
        </div>
      ) : null}

      {pinned ? (
        <article className="mt-6 rounded-2xl border-2 border-primary/60 bg-card p-5 panel-shadow">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Pin className="h-3.5 w-3.5" /> Pinned answer
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-card-foreground">{pinned.content}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {pinned.author_name} · {formatDateTime(pinned.created_at)}
          </p>
        </article>
      ) : null}

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {replies.length} repl{replies.length === 1 ? "y" : "ies"}
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading replies…</p>
        ) : (
          rest.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-card-foreground">{item.author_name}</p>
                {canModerate ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={moderate.isPending}
                    onClick={() => moderate.mutate({ pinned_reply_id: item.id })}
                  >
                    <Pin className="mr-1.5 h-3.5 w-3.5" /> Pin
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-card-foreground">{item.content}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {formatDateTime(item.created_at)}
              </p>
            </article>
          ))
        )}
      </section>

      <form
        className="mt-8 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          reply.mutate();
        }}
      >
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Share what you know…"
          aria-label="Your reply"
        />
        <Button type="submit" disabled={reply.isPending}>
          {reply.isPending ? "Posting…" : "Post reply"}
        </Button>
      </form>
    </div>
  );
}
