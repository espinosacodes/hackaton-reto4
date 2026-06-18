import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a number as Colombian pesos. */
export function cop(value: number, opts: { decimals?: boolean } = {}): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: opts.decimals ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(Math.round(opts.decimals ? value * 100 : value) / (opts.decimals ? 100 : 1));
}

/** Compact pesos: $1,75M */
export function copShort(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}M`;
  if (Math.abs(value) >= 1_000)
    return `$${(value / 1_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })}K`;
  return `$${value.toFixed(0)}`;
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Days between two dates by the Colombian/commercial 360-day convention (each month = 30 days). */
export function days360(start: string | Date, end: string | Date): number {
  const s = typeof start === "string" ? new Date(start + "T00:00:00") : start;
  const e = typeof end === "string" ? new Date(end + "T00:00:00") : end;
  let d1 = s.getDate();
  let d2 = e.getDate();
  const m1 = s.getMonth();
  const m2 = e.getMonth();
  const y1 = s.getFullYear();
  const y2 = e.getFullYear();
  if (d1 === 31) d1 = 30;
  if (d2 === 31) d2 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

/** Calendar days between dates (for alert windows). */
export function daysBetween(start: string | Date, end: string | Date): number {
  const s = typeof start === "string" ? new Date(start + "T00:00:00") : start;
  const e = typeof end === "string" ? new Date(end + "T00:00:00") : end;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000);
}

export function addDays(d: string | Date, n: number): Date {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
