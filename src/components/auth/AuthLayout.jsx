// Full-screen card shared by the auth pages; it sets its own color tokens so it stays readable under any theme.
export function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Icon className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-[26px] font-medium tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-card-foreground sm:p-7">{children}</div>
        {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </div>
  );
}