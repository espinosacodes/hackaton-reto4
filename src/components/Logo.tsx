import { cn } from "@/lib/utils";

/** Centinela wordmark — HG black + legal red. */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <Mark />
      {!compact && (
        <div className="leading-none">
          <div className="font-head text-[17px] tracking-tight text-ink">
            Centinela
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            Hurtado Gandini
          </div>
        </div>
      )}
    </div>
  );
}

export function Mark({ size = 30 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center bg-black"
      style={{ width: size, height: size, borderRadius: "var(--radius)" }}
    >
      <span className="font-head text-[14px] font-bold leading-none text-white">
        H
      </span>
      {/* Red sentinel slash */}
      <span
        className="absolute bottom-0 right-0"
        style={{
          width: size * 0.32,
          height: 3,
          background: "var(--red)",
        }}
      />
    </div>
  );
}
