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
        "rounded-2xl border border-teal-100/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:shadow-teal-100/50 drflow-card-accent",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 p-2.5 text-teal-700">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
