import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 border border-[#2a302c] bg-[#141815] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#f4f1e8] transition hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
