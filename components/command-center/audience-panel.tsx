const COUNTRIES = [
  { name: "United States", pct: 38 },
  { name: "India", pct: 14 },
  { name: "United Kingdom", pct: 9 },
  { name: "Germany", pct: 6 },
  { name: "Canada", pct: 5 },
];

const DEVICES = [
  { label: "Mobile", pct: 52, color: "#e86f3a" },
  { label: "Desktop", pct: 38, color: "#5cb8e0" },
  { label: "TV", pct: 7, color: "#c99a45" },
  { label: "Tablet", pct: 3, color: "#6f6a61" },
];

const TRAFFIC = [
  { label: "YT Search", pct: 41 },
  { label: "Browse Features", pct: 24 },
  { label: "External", pct: 18 },
  { label: "Suggested", pct: 17 },
];

const RETENTION = [100, 82, 68, 54, 46, 43, 42, 41, 40, 40, 39, 38];

export function AudiencePanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#e86f3a]">Audience Overview</span>
          <span className="inline-flex items-center gap-[5px] text-[0.55rem] uppercase tracking-[0.16em] text-[#6f6a61]">
            <span className="h-[5px] w-[5px] rounded-full bg-[#6f6a61]" /> mock
          </span>
        </div>
        <p className="text-[0.66rem] text-[#6f6a61]">Set YOUTUBE_ANALYTICS_TOKEN to enable live cohort data.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Top Countries">
          <div className="space-y-[7px]">
            {COUNTRIES.map((c) => (
              <div key={c.name} className="grid grid-cols-[100px_1fr_32px] items-center gap-2">
                <span className="text-[0.68rem] text-[#f4f1e8]">{c.name}</span>
                <div className="h-[5px] overflow-hidden rounded-[2px] bg-[#1a1c18]">
                  <div className="h-full rounded-[2px] bg-[#e86f3a]/70" style={{ width: `${c.pct}%` }} />
                </div>
                <span className="text-right text-[0.6rem] text-[#8b857b]">{c.pct}%</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Device Mix">
          <div className="space-y-[7px]">
            {DEVICES.map((d) => (
              <div key={d.label} className="grid grid-cols-[70px_1fr_36px] items-center gap-2">
                <span className="text-[0.68rem] text-[#f4f1e8]">{d.label}</span>
                <div className="h-[5px] overflow-hidden rounded-[2px] bg-[#1a1c18]">
                  <div className="h-full rounded-[2px]" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <span className="text-right text-[0.6rem] text-[#8b857b]">{d.pct}%</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Traffic Sources">
          <div className="space-y-[7px]">
            {TRAFFIC.map((t) => (
              <div key={t.label} className="grid grid-cols-[120px_1fr_36px] items-center gap-2">
                <span className="text-[0.68rem] text-[#f4f1e8]">{t.label}</span>
                <div className="h-[5px] overflow-hidden rounded-[2px] bg-[#1a1c18]">
                  <div className="h-full rounded-[2px] bg-[#5cb8e0]/70" style={{ width: `${t.pct}%` }} />
                </div>
                <span className="text-right text-[0.6rem] text-[#8b857b]">{t.pct}%</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Retention Curve">
          <div className="mb-1 text-[0.62rem] text-[#8b857b]">
            Avg view duration: <span className="text-[#e86f3a]">42%</span>
          </div>
          <div className="flex h-16 items-end gap-[3px]">
            {RETENTION.map((pct, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: `${pct}%`,
                  background: `linear-gradient(180deg, #79a875, #79a87544)`,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.52rem] uppercase tracking-[0.12em] text-[#3d4239]">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
      <div className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#e86f3a]">{title}</div>
      {children}
    </div>
  );
}
