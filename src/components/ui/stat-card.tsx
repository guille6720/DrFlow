import { cn } from "@/lib/utils/cn";

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
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs font-medium text-slate-600">{subtitle}</p>
          )}
          {onClick && (
            <p className="mt-2 text-xs font-medium text-teal-700">Clic para ver detalle</p>
          )}
        </div>
        {icon && (
          <div className="rounded-xl bg-gradient-to-br from-teal-50 to-cyan-100 p-2.5 text-teal-700">
            {icon}
          </div>
        )}
      </div>
    </>
  );

  const classes = cn(
    "drflow-card-light rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-md shadow-slate-200/40 transition-shadow drflow-card-accent drflow-ui-stat w-full text-left",
    onClick
      ? "cursor-pointer hover:shadow-lg hover:shadow-teal-100/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
      : "hover:shadow-lg hover:shadow-teal-100/40",
    active && "ring-2 ring-teal-500/40 shadow-lg shadow-teal-100/50",
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
