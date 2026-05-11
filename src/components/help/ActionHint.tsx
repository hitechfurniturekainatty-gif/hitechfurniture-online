import { Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ACTION_HELP } from "@/lib/help/content";

type Props = {
  /** Lookup key in ACTION_HELP, e.g. "quotation.finalize". */
  id?: string;
  /** Override or inline copy. */
  children?: React.ReactNode;
  tone?: "info" | "warn" | "success";
  className?: string;
};

/**
 * Single-line muted hint shown directly under an action button explaining
 * what happens when the user clicks it. Reads from `ACTION_HELP` so the
 * copy stays editable in one place.
 */
export const ActionHint = ({ id, children, tone, className }: Props) => {
  const entry = id ? ACTION_HELP[id] : undefined;
  const text = children ?? entry?.hint;
  const t = tone ?? entry?.tone ?? "info";
  if (!text) return null;
  const Icon = t === "warn" ? AlertTriangle : t === "success" ? CheckCircle2 : Info;
  const color =
    t === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : t === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-muted-foreground";
  return (
    <p className={`mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug ${color} ${className ?? ""}`}>
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{text}</span>
    </p>
  );
};

export default ActionHint;