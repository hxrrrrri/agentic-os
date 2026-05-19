import type { SocialTileData } from "@/lib/command-center/data";

const defaultTiles: SocialTileData[] = [
  { label: "Youtube Subs", value: "-", delta: "not connected", deltaDir: "flat", brand: "youtube", live: false },
  { label: "Youtube Views", value: "-", delta: "not connected", deltaDir: "flat", brand: "youtube", live: false },
  { label: "Instagram", value: "-", delta: "not connected", deltaDir: "flat", brand: "instagram", live: false },
  { label: "TikTok", value: "-", delta: "not connected", deltaDir: "flat", brand: "tiktok", live: false },
];

const gradients: Record<SocialTileData["brand"], string> = {
  youtube:
    "radial-gradient(85% 130% at 88% 50%, rgba(233,120,72,0.18), transparent 50%), linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.2)), #111314",
  instagram:
    "radial-gradient(85% 130% at 88% 50%, rgba(233,120,72,0.14), transparent 50%), linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.2)), #111314",
  tiktok:
    "radial-gradient(85% 130% at 88% 50%, rgba(233,120,72,0.14), transparent 50%), linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.2)), #111314",
};

const borders: Record<SocialTileData["brand"], string> = {
  youtube: "border-[#2a2a2a]/80",
  instagram: "border-[#2a2a2a]/80",
  tiktok: "border-[#2a2a2a]/80",
};

interface Props {
  tiles?: SocialTileData[];
}

export function SocialTiles({ tiles = defaultTiles }: Props) {
  const rows = tiles.length ? tiles : defaultTiles;
  return (
    <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((tile, idx) => (
        <div key={tile.label} className="stagger-item">
          <Tile tile={tile} idx={idx} />
        </div>
      ))}
    </div>
  );
}

function Tile({ tile }: { tile: SocialTileData; idx: number }) {
  const normalizedDelta = tile.delta.trim().toLowerCase();
  const showDelta = normalizedDelta !== "live" && normalizedDelta !== "not connected" && tile.delta.trim() !== "";
  const offline = !tile.live || tile.value === "-";

  return (
    <div
      className={`cc-panel card-lift min-h-[124px] p-[16px_18px] ${borders[tile.brand]}`}
      style={{ background: gradients[tile.brand] }}
    >
      <span
        className={`absolute right-3 top-3 h-[7px] w-[7px] rounded-full ${
          tile.live ? "cc-live-dot bg-[#79a875] shadow-[0_0_6px_#79a875]" : "bg-[#6f6a61]"
        }`}
        title={tile.live ? "connected" : "not connected"}
      />
      <div className="relative z-[1] flex items-center gap-3 pr-12 text-[0.86rem] uppercase tracking-[0.1em] text-[#b8b2aa]">
        <BrandIcon brand={tile.brand} small />
        <span className="truncate">{tile.label}</span>
      </div>
      <div className="relative z-[1] mt-[28px] flex items-end justify-between gap-2">
        <div className="text-[42px] font-black leading-none tracking-tight text-[#f8f2e8]">{tile.value}</div>
      </div>
      <div className="absolute right-5 top-[42px] z-[1] opacity-90">
        <BrandIcon brand={tile.brand} />
      </div>
      <div className="absolute bottom-[13px] left-5 right-5 z-[1] truncate text-[0.82rem] uppercase tracking-[0.1em] text-[#8d877e]">
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
  const size = small ? 18 : 38;
  const color = "#e6e0d4";
  const stroke = small ? 1.8 : 1.6;

  if (brand === "youtube") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <path d="M10 9.5v5l4-2.5z" fill={color} stroke="none" />
      </svg>
    );
  }

  if (brand === "instagram") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill={color} stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 4c.4 2.4 2 4 4.5 4.4" />
    </svg>
  );
}
