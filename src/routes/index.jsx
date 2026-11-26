import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Base44 App" }] }),
  component: HomePage,
});

function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div aria-hidden="true" className="mb-8 w-40 space-y-2.5 rounded-xl border bg-card p-4 shadow-sm">
          <div className="h-2 w-12 rounded-full bg-foreground/80" />
          <div className="h-2 w-full rounded-full bg-muted" />
          <div className="h-2 w-3/4 rounded-full bg-muted" />
          <div className="grid grid-cols-3 gap-2 pt-1.5">
            <div className="h-8 rounded-md bg-muted" />
            <div className="h-8 rounded-md bg-muted" />
            <div className="h-8 rounded-md bg-muted" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your app will appear here</h1>
        <p className="mt-2 text-balance text-sm text-muted-foreground">Describe what you want to build, and this page becomes it.</p>
      </div>
    </main>
  );
}
