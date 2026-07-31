import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "drflow-card-light rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-md shadow-slate-200/40 transition-shadow hover:shadow-lg hover:shadow-teal-100/40 drflow-card-accent drflow-ui-stat",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs font-medium text-slate-600">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-xl bg-gradient-to-br from-teal-50 to-cyan-100 p-2.5 text-teal-700">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
