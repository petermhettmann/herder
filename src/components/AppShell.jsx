import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

// Mobile-first chrome: 375px baseline, grows to a comfortable reading column on desktop.
export default function AppShell({ children }) {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-[480px] items-center justify-between px-5">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-[15px] font-medium tracking-tight">Herder</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Solo</span>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="-mr-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-16 pt-8">{children}</main>
    </div>
  );
}