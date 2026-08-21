import { cn } from "@/shared/utils/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  className,
  onClick,
  active,
}: StatCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--muted-foreground,#475569)]">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground,#0f172a)]">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs font-medium text-[var(--muted-foreground,#475569)]">{subtitle}</p>
          )}
          {onClick && (
            <p className="mt-2 text-xs font-medium text-[var(--primary)]">Clic para ver detalle</p>
          )}
        </div>
        {icon && (
          <div className="rounded-xl bg-[var(--accent-soft)] p-2.5 text-[var(--primary)]">
            {icon}
          </div>
        )}
      </div>
    </>
  );

  const classes = cn(
    "drflow-card-light rounded-[10px] border border-[var(--border-default,var(--border))] bg-[var(--surface-card,var(--card))] p-5 text-[var(--text-on-card,var(--card-foreground))] shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-shadow drflow-card-accent drflow-ui-stat w-full text-left",
    onClick
      ? "cursor-pointer hover:bg-[var(--surface-hover,var(--muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40"
      : "hover:bg-[var(--surface-hover,var(--muted))]",
    active && "ring-2 ring-[var(--ring)]/40",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-pressed={active}>
        {inner}
      </button>
    );
  }

  return <div className={classes}>{inner}</div>;
}
