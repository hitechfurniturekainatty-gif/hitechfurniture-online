import { Link } from "react-router-dom";
import { AlertTriangle, TrendingDown } from "lucide-react";

export type Anomaly = {
  key: string;
  message: string;
  severity: "warning" | "critical";
  to?: string;
  icon?: any;
};

// Row of anomaly pills — only renders when there's something to flag, so a
// clean dashboard stays clean. Never invents an anomaly: callers only push
// an entry once the underlying live query actually crosses the threshold.
export const AnomalyBadges = ({ anomalies }: { anomalies: Anomaly[] }) => {
  if (anomalies.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {anomalies.map((a) => {
        const Icon = a.icon ?? (a.severity === "critical" ? AlertTriangle : TrendingDown);
        const toneClasses =
          a.severity === "critical"
            ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
        const content = (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClasses}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {a.message}
          </span>
        );
        return a.to ? (
          <Link key={a.key} to={a.to} className="transition-smooth hover:opacity-80">{content}</Link>
        ) : (
          <span key={a.key}>{content}</span>
        );
      })}
    </div>
  );
};
