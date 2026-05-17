import { describe, it, expect } from "vitest";
import cron from "node-cron";

// Mirror of the natural-language parser in lib/scheduler/worker.ts so we can unit-test the rules
// without touching its scheduling side-effects. Keep in sync if the source changes.
function naturalToCron(schedule: string): string | null {
  const s = schedule.toLowerCase().trim();
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? parseInt(timeMatch[1], 10) : 9;
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  if (/^every\s+(day|24h|daily)/.test(s) || s.includes("every day")) return `${minute} ${hour} * * *`;
  if (s.includes("weekday")) return `${minute} ${hour} * * 1-5`;
  if (s.includes("monday")) return `${minute} ${hour} * * 1`;
  if (s.includes("tuesday")) return `${minute} ${hour} * * 2`;
  if (s.includes("wednesday")) return `${minute} ${hour} * * 3`;
  if (s.includes("thursday")) return `${minute} ${hour} * * 4`;
  if (s.includes("friday")) return `${minute} ${hour} * * 5`;
  if (s.includes("saturday")) return `${minute} ${hour} * * 6`;
  if (s.includes("sunday")) return `${minute} ${hour} * * 0`;
  if (/^\d/.test(s) && /\d \d/.test(s) && s.split(/\s+/).length >= 5) return s;
  return null;
}

describe("scheduler/naturalToCron", () => {
  it("daily 08:00", () => {
    expect(naturalToCron("every day at 08:00")).toBe("0 8 * * *");
  });

  it("weekday 10:00", () => {
    expect(naturalToCron("weekday 10:00")).toBe("0 10 * * 1-5");
  });

  it("friday afternoon", () => {
    expect(naturalToCron("friday 17:00")).toBe("0 17 * * 5");
  });

  it("returns null for unparseable", () => {
    expect(naturalToCron("every 9 hours")).toBeNull();
    expect(naturalToCron("sometimes")).toBeNull();
  });

  it("output is valid cron when not null", () => {
    const expr = naturalToCron("every day at 06:30");
    expect(expr).not.toBeNull();
    expect(cron.validate(expr as string)).toBe(true);
  });
});
