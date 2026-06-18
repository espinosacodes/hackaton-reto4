import Image from "next/image";
import { cn } from "@/lib/utils";

/** Centinela lockup — official Hurtado Gandini logo + product name. */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      <Mark />
      {!compact && (
        <div className="border-l border-border pl-3 leading-none">
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

/** HG brand mark — official wordmark (white) on a black plate. */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center bg-black px-2.5"
      style={{ height: size, borderRadius: "var(--radius)" }}
    >
      <Image
        src="/logo-hg.webp"
        alt="Hurtado Gandini"
        width={1736}
        height={418}
        priority
        className="w-auto object-contain"
        style={{ height: size * 0.5 }}
      />
    </div>
  );
}
