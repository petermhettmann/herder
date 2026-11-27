import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Images, List, LogOut, Upload, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/history", label: "Sessions", icon: List },
  { to: "/archive", label: "Archive", icon: Images },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/mistress", label: "Mistress", icon: Wand2 },
];

// Mobile-first chrome: 375px baseline, grows to a comfortable reading column on desktop.
export default function AppShell({ children }) {
  const { logout } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-[480px] items-center justify-between px-5">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-heading text-[15px] font-medium tracking-tight">Herder</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Solo</span>
          </Link>
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

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-24 pt-8">{children}</main>

      <nav className="sticky bottom-0 z-20 border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-[480px]">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}