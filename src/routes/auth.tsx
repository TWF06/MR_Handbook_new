import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fetchSession } from "@/hooks/use-session";
import { recordAudit } from "@/lib/queries";
import { bootstrapDemoAccounts } from "@/lib/admin.functions";
import { SEED_USERS } from "@/lib/seed-data";

/** Only same-origin relative paths may be used as a post-sign-in destination. */
function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = safeNext(search['next']);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — MR Handbook Manager" },
      {
        name: "description",
        content: "Sign in to the MR Handbook Manager portal to read handbooks, SOPs and manuals.",
      },
      { property: "og:title", content: "Sign in — MR Handbook Manager" },
      {
        property: "og:description",
        content: "Access company handbooks, SOPs and the FAQ board for your department.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const bootstrap = useServerFn(bootstrapDemoAccounts);
  const [mode, setMode] = useState<"signin" | "recover">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const goToLanding = useCallback(async () => {
    // A preserved destination (e.g. an OAuth consent request) wins over the default landing page.
    if (next) {
      window.location.replace(next);
      return;
    }
    const session = await fetchSession();
    navigate({ to: session?.isManagement ? "/admin" : "/staff", replace: true });
  }, [navigate, next]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void goToLanding();
    });
  }, [goToLanding]);

  // Idempotent: only creates the demo roster when the database has no employees.
  useEffect(() => {
    bootstrap({}).catch(() => undefined);
  }, [bootstrap]);

  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    onSuccess: async () => {
      const session = await fetchSession();
      if (!session) {
        toast.error("Account disabled, please contact your admin");
        return;
      }
      toast.success("Welcome back");
      await recordAudit(session.employeeId, session.name, "Signed in").catch(() => undefined);
      if (next) {
        window.location.replace(next);
        return;
      }
      navigate({ to: session.isManagement ? "/admin" : "/staff", replace: true });
    },
    onError: (error: Error) =>
      toast.error(
        error.message.toLowerCase().includes("invalid")
          ? "Those credentials don't match an active account."
          : error.message,
      ),
  });


  const recover = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("If that account exists, a reset link is on its way."),
    onError: (error: Error) => toast.error(error.message),
  });

  const pending = signIn.isPending || recover.isPending;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 lg:flex">
        <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            MR
          </span>
          Handbook Manager
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-sidebar-foreground">
            Documentation your team can trust.
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Handbooks, SOPs and manuals scoped to each department and hierarchy level, with a live
            FAQ board and a complete audit trail.
          </p>
        </div>
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Need access?
          </p>
          <p className="mt-2 text-xs text-sidebar-foreground">
            Accounts are created by Management. Contact your manager or HR if you don't have one yet.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm pane-fade">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "signin" ? "Sign in" : "Reset your password"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Use your work email and password."
              : "We'll email you a secure link to choose a new password."}
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mode === "signin") signIn.mutate();
              else recover.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </div>

            {mode === "signin" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Working…" : mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "recover" : "signin")}
            className="mt-6 text-sm text-accent underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Forgot your password?" : "Back to sign in"}
          </button>

        </div>
      </div>
    </div>
  );
}
