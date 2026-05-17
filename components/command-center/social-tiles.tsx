import type { SocialTileData } from "@/lib/command-center/data";

const defaultTiles: SocialTileData[] = [
  { label: "Youtube Subs", value: "-", delta: "not connected", deltaDir: "flat", brand: "youtube", live: false },
  { label: "Youtube Views", value: "-", delta: "not connected", deltaDir: "flat", brand: "youtube", live: false },
  { label: "Instagram", value: "-", delta: "not connected", deltaDir: "flat", brand: "instagram", live: false },
  { label: "TikTok", value: "-", delta: "not connected", deltaDir: "flat", brand: "tiktok", live: false },
];

const gradients: Record<SocialTileData["brand"], string> = {
  youtube:
    "linear-gradient(135deg, rgba(255,28,28,0.18) 0%, rgba(160,20,20,0.08) 45%, rgba(60,8,8,0) 100%), #150c0a",
  instagram:
    "linear-gradient(135deg, rgba(255,180,60,0.18) 0%, rgba(225,48,108,0.10) 50%, rgba(80,30,8,0) 100%), #15110a",
  tiktok:
    "linear-gradient(135deg, rgba(255,40,120,0.20) 0%, rgba(0,200,220,0.10) 60%, rgba(40,8,30,0) 100%), #130a11",
};

const borders: Record<SocialTileData["brand"], string> = {
  youtube: "border-[#7a2018]/60",
  instagram: "border-[#7a4318]/60",
  tiktok: "border-[#7a1842]/60",
};

interface Props {
  tiles?: SocialTileData[];
}

export function SocialTiles({ tiles = defaultTiles }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tiles.map((tile) => (
        <Tile key={tile.label} tile={tile} />
      ))}
    </div>
  );
}

function Tile({ tile }: { tile: SocialTileData }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[3px] border ${borders[tile.brand]} p-3`}
      style={{ background: gradients[tile.brand] }}
    >
      <span
        className={`absolute right-2 top-2 h-[6px] w-[6px] rounded-full ${
          tile.live ? "bg-[#79a875] shadow-[0_0_6px_#79a875]" : "bg-[#6f6a61]"
        }`}
        title={tile.live ? "live data" : "cached / mock"}
      />
      <div className="text-[0.56rem] uppercase tracking-[0.18em] text-[#a8a29a]">{tile.label}</div>
      <div className="mt-5 flex items-end justify-between gap-2">
        <div className="font-black leading-none tracking-tight text-[#f4f1e8] text-[28px]">{tile.value}</div>
        <BrandIcon brand={tile.brand} />
      </div>
      <div className="mt-[10px] text-[0.6rem] uppercase tracking-[0.14em] text-[#8b857b]">
        {tile.deltaDir === "up" ? <span className="text-[#79a875]">▲ </span> : tile.deltaDir === "down" ? <span className="text-[#c4605a]">▼ </span> : <span className="text-[#6f6a61]">· </span>}
        {tile.delta}
      </div>
    </div>
  );
}

function BrandIcon({ brand }: { brand: SocialTileData["brand"] }) {
  if (brand === "youtube") {
    return (
      <div className="flex h-9 w-12 items-center justify-center rounded-[4px] bg-[#ff1c1c] shadow-[0_0_12px_rgba(255,28,28,0.4)]">
        <svg viewBox="0 0 24 24" width="14" height="14"><polygon points="9,6 19,12 9,18" fill="#fff" /></svg>
      </div>
    );
  }
  if (brand === "instagram") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#ffb43c] via-[#ff7a45] to-[#e1306c] shadow-[0_0_12px_rgba(255,140,60,0.45)]">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="1.8">
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="17" cy="7" r="0.8" fill="#fff" />
        </svg>
      </div>
    );
  }
  return (
    <div className="relative flex h-9 w-9 items-center justify-center rounded-[6px] bg-[#0a0a0a] shadow-[0_0_12px_rgba(255,40,120,0.35)]">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M14 4v9.5a2.5 2.5 0 1 1-2.5-2.5" stroke="#25f4ee" strokeWidth="1.8" fill="none" />
        <path d="M15 4v9.5a2.5 2.5 0 1 1-2.5-2.5V4" stroke="#fe2c55" strokeWidth="1.8" fill="none" transform="translate(0.6,0.6)" />
        <path d="M14 4v9.5a2.5 2.5 0 1 1-2.5-2.5V4h1a4 4 0 0 0 4 4" stroke="#fff" strokeWidth="1.6" fill="none" />
      </svg>
    </div>
  );
}
