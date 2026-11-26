import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Herder" },
      { name: "description", content: "Herder, a single-user tracker for what needs herding." },
      { name: "theme-color", content: "#0e0e11" },
    ],
  }),
  component: HomePage,
});

const directions = [
  { n: "01", label: "Tasks and priorities", detail: "One list of what actually needs doing today." },
  { n: "02", label: "Animals and livestock", detail: "Herd records, health, breeding and history." },
  { n: "03", label: "People and follow-ups", detail: "Where each relationship stands, and what is owed." },
];

function HomePage() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3 w-20 rounded-sm bg-secondary" />
        <div className="h-7 w-64 rounded-sm bg-secondary" />
        <div className="h-3 w-48 rounded-sm bg-secondary" />
        <div className="mt-8 h-40 rounded-xl border border-border" />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Setting up</p>

      <h1 className="mt-3 font-heading text-[27px] font-medium leading-[1.15] tracking-[-0.02em]">
        Herder is ready.
        <br />
        <span className="text-muted-foreground">Nothing to track yet.</span>
      </h1>

      <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
        The frame is built: dark, flat, one accent, sized for a phone. The tracker lands here as soon as you name it.
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-border">
        {directions.map((item) => (
          <div
            key={item.n}
            className="flex gap-4 border-b border-border px-4 py-4 last:border-b-0"
          >
            <span className="tnum w-5 shrink-0 pt-[2px] text-[11px] text-muted-foreground">
              {item.n}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium leading-tight">{item.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Signed in as <span className="text-foreground">{user?.email || "your account"}</span>
      </p>
    </div>
  );
}