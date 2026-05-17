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
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[0.56rem] uppercase tracking-[0.18em] text-[#a8a29a]">Schedule</span>
        <span className="flex items-center gap-2 text-[0.56rem] uppercase tracking-[0.14em] text-[#6f6a61]">
          <Clock size={10} className="text-[#e86f3a]" />
          {slots.length} events
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-[6px]">
        {slots.map((slot, idx) => (
          <div
            key={`${slot.time}-${slot.label}-${idx}`}
            className="grid grid-cols-[44px_1fr] items-baseline gap-2 text-[0.7rem]"
          >
            <span className="text-[#e86f3a] font-bold tracking-tight">{slot.time}</span>
            <span className="truncate text-[#f4f1e8]">{slot.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
