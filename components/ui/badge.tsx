import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tone = {
  green: "border-[#79a875]/40 bg-[#79a875]/10 text-[#9fc39b]",
  yellow: "border-[#c99a45]/40 bg-[#c99a45]/10 text-[#e0b96b]",
  red: "border-[#c4605a]/40 bg-[#c4605a]/10 text-[#d9827d]",
  orange: "border-[#e86f3a]/50 bg-[#e86f3a]/10 text-[#e86f3a]",
  gray: "border-[#2a302c] bg-[#141815] text-[#a8a29a]",
};

export function Badge({ className, tone: selectedTone = "gray", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em]",
        tone[selectedTone],
        className,
      )}
      {...props}
    />
  );
}
