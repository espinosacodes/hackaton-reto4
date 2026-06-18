import { cn } from "@/lib/utils";
import { Severidad } from "@/lib/types";

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("hairline bg-surface", className)}
      style={{ borderRadius: "var(--radius)" }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  overline,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  overline?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        {overline && <div className="overline mb-1">{overline}</div>}
        <h3 className="font-head text-[17px] leading-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────
const badgeTone: Record<string, string> = {
  neutral: "bg-surface-2 text-ink-2 border-border",
  red: "bg-red-tint text-red-dark border-red/30",
  success: "bg-[var(--success-tint)] text-[var(--success)] border-[var(--success)]/30",
  warning: "bg-[var(--warning-tint)] text-[var(--warning)] border-[var(--warning)]/30",
  info: "bg-[var(--info-tint)] text-[var(--info)] border-[var(--info)]/30",
  black: "bg-black text-white border-black",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        badgeTone[tone],
        className
      )}
      style={{ borderRadius: "var(--radius)" }}
    >
      {children}
    </span>
  );
}

// ── Severity → tone mapping ────────────────────────────────────────────────
export const sevTone: Record<Severidad, keyof typeof badgeTone> = {
  critica: "red",
  alta: "warning",
  media: "info",
  info: "neutral",
};
export const sevLabel: Record<Severidad, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  info: "Info",
};
export const sevColor: Record<Severidad, string> = {
  critica: "var(--red)",
  alta: "var(--warning)",
  media: "var(--info)",
  info: "var(--ink-3)",
};

export function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0"
      style={{ background: color, borderRadius: "var(--radius)" }}
    />
  );
}

// ── Button ────────────────────────────────────────────────────────────────
export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-black text-white hover:bg-[#262626] border-black",
    secondary: "bg-surface text-ink border-border-2 hover:bg-surface-2",
    ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-2",
    danger: "bg-red text-white border-red hover:bg-red-dark",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        styles,
        className
      )}
      style={{ borderRadius: "var(--radius)" }}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Progress bar ────────────────────────────────────────────────────────────
export function Progress({
  value,
  tone = "var(--black)",
  className,
}: {
  value: number;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={cn("h-1.5 w-full bg-surface-inset", className)}>
      <div
        className="h-full transition-all duration-700"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: tone }}
      />
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="overline">{label}</div>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <div
        className="font-num mt-2 text-[28px] leading-none"
        style={{ color: tone ?? "var(--ink)" }}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-ink-2">{sub}</div>}
    </Card>
  );
}
