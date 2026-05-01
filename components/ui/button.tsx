import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-[3px] border border-[#30342c] bg-[#111310] px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#f4f1e8] transition hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
