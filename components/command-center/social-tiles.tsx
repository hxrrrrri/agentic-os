import { Instagram, Music2, Youtube } from "lucide-react";
import type { SocialTileData } from "@/lib/command-center/data";

const defaultTiles: SocialTileData[] = [
  { label: "Youtube Subs", value: "-", delta: "not connected", deltaDir: "flat", brand: "youtube", live: false },
  { label: "Youtube Views", value: "-", delta: "not connected", deltaDir: "flat", brand: "youtube", live: false },
  { label: "Instagram", value: "-", delta: "not connected", deltaDir: "flat", brand: "instagram", live: false },
  { label: "TikTok", value: "-", delta: "not connected", deltaDir: "flat", brand: "tiktok", live: false },
];

const gradients: Record<SocialTileData["brand"], string> = {
  youtube:
    "radial-gradient(85% 130% at 90% 52%, rgba(255,58,70,0.42), transparent 45%), linear-gradient(90deg, rgba(255,54,36,0.08), rgba(255,54,36,0.02) 42%, transparent), #121315",
  instagram:
    "radial-gradient(80% 120% at 86% 48%, rgba(232,191,70,0.46), transparent 45%), linear-gradient(90deg, rgba(232,191,70,0.08), rgba(225,48,108,0.04) 55%, transparent), #121315",
  tiktok:
    "radial-gradient(80% 120% at 88% 52%, rgba(255,55,132,0.42), transparent 45%), linear-gradient(90deg, rgba(255,40,120,0.06), rgba(0,200,220,0.03) 55%, transparent), #121315",
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
  const rows = tiles.length ? tiles : defaultTiles;
  return (
    <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((tile) => (
        <Tile key={tile.label} tile={tile} />
      ))}
    </div>
  );
}

function Tile({ tile }: { tile: SocialTileData }) {
  const normalizedDelta = tile.delta.trim().toLowerCase();
  const showDelta = normalizedDelta !== "live" && normalizedDelta !== "not connected" && tile.delta.trim() !== "";
  const offline = !tile.live || tile.value === "-";

  return (
    <div
      className={`cc-panel min-h-[124px] p-[16px_18px] ${borders[tile.brand]}`}
      style={{ background: gradients[tile.brand] }}
    >
      <span
        className={`absolute right-3 top-3 h-[7px] w-[7px] rounded-full ${
          tile.live ? "cc-live-dot bg-[#79a875] shadow-[0_0_6px_#79a875]" : "bg-[#6f6a61]"
        }`}
        title={tile.live ? "connected" : "not connected"}
      />
      <div className="relative z-[1] flex items-center gap-3 pr-12 text-[0.82rem] uppercase tracking-[0.1em] text-[#b8b2aa]">
        <BrandIcon brand={tile.brand} small />
        <span className="truncate">{tile.label}</span>
      </div>
      <div className="relative z-[1] mt-[28px] flex items-end justify-between gap-2">
        <div className="text-[42px] font-black leading-none tracking-tight text-[#f8f2e8]">{tile.value}</div>
      </div>
      <div className="absolute right-5 top-[42px] z-[1]">
        <BrandIcon brand={tile.brand} />
      </div>
      <div className="absolute bottom-[13px] left-5 right-5 z-[1] truncate text-[0.78rem] uppercase tracking-[0.1em] text-[#8d877e]">
        {showDelta ? (
          <>
            {tile.deltaDir === "up" ? <span className="text-[#79d783]">▲ </span> : tile.deltaDir === "down" ? <span className="text-[#c4605a]">▼ </span> : <span className="text-[#6f6a61]">- </span>}
            {tile.delta}
          </>
        ) : offline ? (
          <span>- not connected</span>
        ) : null}
      </div>
    </div>
  );
}

function BrandIcon({ brand, small = false }: { brand: SocialTileData["brand"]; small?: boolean }) {
  const Icon = brand === "youtube" ? Youtube : brand === "instagram" ? Instagram : Music2;
  const sizeClass = small ? "h-6 w-6 rounded-[2px]" : "h-14 w-14 rounded-[5px]";
  const iconSize = small ? 14 : 28;

  if (brand === "youtube") {
    return (
      <div className={`flex ${sizeClass} shrink-0 items-center justify-center bg-[#ed3e45] text-white shadow-[0_0_18px_rgba(237,62,69,0.55)]`}>
        <Icon size={iconSize} strokeWidth={small ? 2.1 : 1.9} />
      </div>
    );
  }

  if (brand === "instagram") {
    return (
      <div className={`flex ${sizeClass} shrink-0 items-center justify-center bg-gradient-to-br from-[#e6bd42] via-[#d58c34] to-[#a8792d] text-white shadow-[0_0_18px_rgba(230,189,66,0.55)]`}>
        <Icon size={iconSize} strokeWidth={small ? 2.1 : 1.9} />
      </div>
    );
  }

  return (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center bg-[#121315] text-[#25f4ee] shadow-[0_0_18px_rgba(255,40,120,0.5)] ring-1 ring-[#fe2c55]/60`}>
      <Icon size={iconSize} strokeWidth={small ? 2.1 : 1.9} />
    </div>
  );
}
