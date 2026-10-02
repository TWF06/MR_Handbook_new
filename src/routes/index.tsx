import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpenText, MessagesSquare, ScrollText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MR Handbook Manager — Handbooks, SOPs & Audit Trails" },
      {
        name: "description",
        content:
          "Secure portal for company handbooks, SOPs and worker manuals with role-based access, a live FAQ board and full audit logging.",
      },
      { property: "og:title", content: "MR Handbook Manager" },
      {
        property: "og:description",
        content:
          "One portal for handbooks, SOPs and worker manuals — scoped to each department and hierarchy level.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: BookOpenText,
    title: "Living handbook",
    body: "Sections and documents rendered from Markdown with a sticky table of contents and instant search.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Ten roles across Management, BOH and FOH. Content, actions and data are scoped by hierarchy level.",
  },
  {
    icon: MessagesSquare,
    title: "FAQ board",
    body: "Ask, answer, pin the best reply and mark threads resolved — updated live for everyone on shift.",
  },
  {
    icon: ScrollText,
    title: "Audit trail",
    body: "Every administrative action is timestamped and attributed, ready for inspection.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            MR
          </span>
          Handbook Manager
        </span>
        <Button asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-20">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Operations portal
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
            Every handbook, SOP and manual your team needs — and nothing they shouldn't see.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            MR Handbook Manager keeps front-of-house, back-of-house and management documentation in
            one place, with granular role-based access, a live FAQ board and a complete audit log.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Open the portal</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Recover access</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-6 panel-shadow"
            >
              <feature.icon className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold text-card-foreground">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        MR Handbook Manager — internal use only.
      </footer>
    </div>
  );
}
