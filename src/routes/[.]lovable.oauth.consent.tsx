import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface AuthorizationClient {
  name?: string;
  client_name?: string;
  redirect_uri?: string;
}

interface AuthorizationDetails {
  client?: AuthorizationClient | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
}

interface OAuthResult {
  data: AuthorizationDetails | null;
  error: { message: string } | null;
}

// The supabase.auth.oauth namespace is beta; this keeps it typed locally.
const oauth = () =>
  (
    supabase.auth as unknown as {
      oauth: {
        getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
        approveAuthorization: (id: string) => Promise<OAuthResult>;
        denyAuthorization: (id: string) => Promise<OAuthResult>;
      };
    }
  ).oauth;

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm who you are",
  email: "Share your email address",
  profile: "Share your basic profile",
};

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the session lives in local storage, absent during SSR.
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search['authorization_id'] === "string" ? search['authorization_id'] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-foreground">This request can't be completed</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Start the connection again from the app you were using.
      </p>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "An app";
  const redirectUri = details?.client?.redirect_uri;
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No return address was provided. Start the connection again.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-border bg-card p-6 panel-shadow">
        <h1 className="text-xl font-semibold text-card-foreground">
          Connect {clientName} to MR Handbook
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {clientName} will be able to read and maintain handbook content as you, using your own
          permissions.
        </p>

        {redirectUri ? (
          <p className="mt-4 break-all text-xs text-muted-foreground">Returns to {redirectUri}</p>
        ) : null}

        {scopes.length > 0 ? (
          <ul className="mt-5 space-y-2 text-sm text-card-foreground">
            {scopes.map((scope) => (
              <li key={scope}>
                • {SCOPE_LABELS[scope] ?? `Additional permission requested: ${scope}`}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-5 text-xs text-muted-foreground">
          This does not give it more access than your account already has.
        </p>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Cancel connection
          </Button>
        </div>
      </div>
    </main>
  );
}
