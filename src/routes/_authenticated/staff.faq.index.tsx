import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { newId, recordAudit, replyCountsQuery, threadsQuery } from "@/lib/queries";
import { formatDate } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/staff/faq/")({
  component: StaffFaqBoard,
});

function StaffFaqBoard() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { data: threads = [], isLoading } = useQuery(threadsQuery);
  const { data: counts = {} } = useQuery(replyCountsQuery);

  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  useEffect(() => {
    const channel = supabase
      .channel("faq-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "faq_threads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faq_threads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "faq_replies" }, () => {
        queryClient.invalidateQueries({ queryKey: ["faq_reply_counts"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const ask = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("You are not signed in.");
      const cleanTitle = title.trim();
      const cleanBody = body.trim();
      if (cleanTitle.length < 5) throw new Error("Give your question a clearer title.");
      if (cleanTitle.length > 200) throw new Error("Titles must be under 200 characters.");
      if (cleanBody.length > 4000) throw new Error("Questions must be under 4000 characters.");

      const threadId = newId("thread");
      const { error } = await supabase.from("faq_threads").insert({
        id: threadId,
        author_id: session.employeeId,
        author_name: session.name,
        title: cleanTitle,
      });
      if (error) throw new Error(error.message);

      if (cleanBody) {
        const { error: replyError } = await supabase.from("faq_replies").insert({
          id: newId("reply"),
          thread_id: threadId,
          author_id: session.employeeId,
          author_name: session.name,
          content: cleanBody,
        });
        if (replyError) throw new Error(replyError.message);
      }

      await recordAudit(session.employeeId, session.name, `Posted FAQ question "${cleanTitle}"`);
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setComposerOpen(false);
      toast.success("Question posted");
      queryClient.invalidateQueries({ queryKey: ["faq_threads"] });
      queryClient.invalidateQueries({ queryKey: ["faq_reply_counts"] });
      queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const visible = threads.filter((thread) =>
    filter === "all" ? true : filter === "open" ? !thread.resolved : thread.resolved,
  );

  return (
    <div className="pane-fade mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">FAQ board</h1>
          <p className="mt-2 text-muted-foreground">
            Ask the team, answer each other, and pin the reply that settles it.
          </p>
        </div>
        <Button onClick={() => setComposerOpen((open) => !open)}>
          <Plus className="mr-2 h-4 w-4" /> Ask a question
        </Button>
      </div>

      {composerOpen ? (
        <form
          className="pane-fade mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 panel-shadow"
          onSubmit={(event) => {
            event.preventDefault();
            ask.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="thread-title">Question</Label>
            <Input
              id="thread-title"
              value={title}
              maxLength={200}
              required
              onChange={(event) => setTitle(event.target.value)}
              placeholder="How do we log a fridge temperature breach?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thread-body">Details (optional)</Label>
            <Textarea
              id="thread-body"
              value={body}
              maxLength={4000}
              rows={4}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add any context that helps someone answer."
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={ask.isPending}>
              {ask.isPending ? "Posting…" : "Post question"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-8 flex gap-2">
        {(["all", "open", "resolved"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
            className="capitalize"
          >
            {value}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading threads…</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing here yet — start the first thread.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((thread) => (
            <li key={thread.id}>
              <Link
                to="/staff/faq/$threadId"
                params={{ threadId: thread.id }}
                className="block rounded-2xl border border-border bg-card p-5 transition-colors panel-shadow hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-card-foreground">{thread.title}</h2>
                  {thread.resolved ? (
                    <Badge className="shrink-0 bg-success text-success-foreground">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Resolved
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      Open
                    </Badge>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{thread.author_name}</span>
                  <span>{formatDate(thread.created_at)}</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> {counts[thread.id] ?? 0}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
