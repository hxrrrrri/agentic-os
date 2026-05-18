import { Clock } from "lucide-react";
import type { ScheduleSlot } from "@/lib/command-center/data";

const defaultSlots: ScheduleSlot[] = [
  { time: "08:00", label: "Gym" },
  { time: "09:30", label: "Short-form video" },
  { time: "11:30", label: "Lunch" },
  { time: "12:30", label: "Long-form video edit" },
  { time: "15:30", label: "Buffer" },
  { time: "16:00", label: "Skool Email" },
  { time: "16:15", label: "Streaming / go live" },
  { time: "18:15", label: "Ops block 2" },
];

interface Props {
  slots?: ScheduleSlot[];
}

export function SchedulePanel({ slots = defaultSlots }: Props) {
  return (
    <div className="cc-panel cc-panel-muted min-h-[154px] overflow-hidden p-[16px_18px]">
      <div className="relative z-[1] mb-3 flex items-center justify-between gap-3">
        <span className="text-[0.82rem] uppercase tracking-[0.12em] text-[#a8a29a]">Schedule</span>
        <span className="flex items-center gap-2 text-[0.84rem] uppercase tracking-[0.1em] text-[#8d877e]">
          <Clock size={14} className="text-[#e86f3a]" />
          {slots.length} events
        </span>
      </div>
      <div className="relative z-[1] grid grid-cols-1 gap-x-8 gap-y-[10px] sm:grid-cols-2">
        {slots.map((slot, idx) => (
          <div
            key={`${slot.time}-${slot.label}-${idx}`}
            className="grid grid-cols-[64px_1fr] items-baseline gap-3 text-[0.98rem]"
          >
            <span className="text-[#e86f3a] font-bold tracking-tight">{slot.time}</span>
            <span className="truncate text-[#f4f1e8]">{slot.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
