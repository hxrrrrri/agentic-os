import Link from "next/link";
import type { VaultLink } from "@/lib/db/repositories";

export function BacklinksPanel({
  notePath,
  backlinks,
  outlinks,
}: {
  notePath: string;
  backlinks: VaultLink[];
  outlinks: VaultLink[];
}) {
  return (
    <div className="terminal-panel bg-[#121411] p-3">
      <div className="terminal-label mb-3 text-[#f4f1e8]">
        Links — <span className="text-[#e86f3a]">{notePath.split("/").pop()}</span>
      </div>

      <Section title="Backlinks" count={backlinks.length} accent>
        {backlinks.length === 0 ? (
          <div className="text-[0.7rem] text-[#6f6a61]">No notes link here yet.</div>
        ) : (
          backlinks.map((link) => (
            <LinkRow key={`${link.source}→${link.target}`} path={link.source} label={link.source.split("/").pop() ?? link.source} />
          ))
        )}
      </Section>

      <Section title="Outlinks" count={outlinks.length}>
        {outlinks.length === 0 ? (
          <div className="text-[0.7rem] text-[#6f6a61]">No links in this note.</div>
        ) : (
          outlinks.map((link) => (
            <LinkRow
              key={`${link.source}→${link.target}`}
              path={link.resolvedPath ?? ""}
              label={link.target}
              unresolved={!link.resolvedPath}
            />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        <span className={`text-[0.6rem] font-bold uppercase tracking-[0.18em] ${accent ? "text-[#e86f3a]" : "text-[#a8a29a]"}`}>
          {title}
        </span>
        <span className="rounded-[2px] border border-[#2a302c] bg-[#080a09] px-[5px] py-[1px] text-[0.52rem] text-[#6f6a61]">
          {count}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function LinkRow({
  path,
  label,
  unresolved,
}: {
  path: string;
  label: string;
  unresolved?: boolean;
}) {
  const content = (
    <div className={`border border-[#2a302c] bg-[#080a09] p-2 text-[0.7rem] transition ${unresolved ? "opacity-50" : "hover:border-[#e86f3a]"}`}>
      <span className={`font-bold ${unresolved ? "text-[#6f6a61]" : "text-[#f4f1e8]"}`}>
        {label.replace(/\.md$/, "")}
      </span>
      {unresolved ? <span className="ml-2 text-[0.58rem] text-[#6f6a61]">(unresolved)</span> : null}
    </div>
  );

  if (!path || unresolved) return <div>{content}</div>;
  return <Link href={`/vault?path=${encodeURIComponent(path)}`}>{content}</Link>;
}
