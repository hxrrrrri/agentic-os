interface LatestUploadProps {
  title?: string;
  views?: string;
  likes?: string;
  comments?: string;
  age?: string;
  url?: string;
}

export function LatestUpload({
  title = "YouTube not connected",
  views = "-",
  likes = "-",
  comments = "-",
  age = "NO API KEY",
  url,
}: LatestUploadProps) {
  const sample = title === "YouTube not connected";
  const displayTitle = sample ? "My Secret Content Claude Code Skill" : title;
  const displayViews = sample ? "1.5K" : views;
  const displayLikes = sample ? "78" : likes;
  const displayComments = sample ? "1" : comments;
  const displayAge = sample ? "11H OLD" : age;
  const PlayInner = (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <polygon points="9,6 19,12 9,18" fill="#fff" />
    </svg>
  );
  return (
    <div
      className="cc-panel min-h-[118px] border-[#5a1818]/60 p-[16px_18px]"
      style={{
        background:
          "linear-gradient(90deg, rgba(255,28,28,0.10) 0%, rgba(40,10,10,0.02) 35%, transparent 100%), #110a09",
      }}
    >
      <span className="cc-live-dot absolute right-3 top-3 h-[7px] w-[7px] rounded-full bg-[#79a875] shadow-[0_0_6px_#79a875]" />

      <div className="relative z-[1] text-[0.82rem] uppercase tracking-[0.12em] text-[#b8b2aa]">Latest Upload</div>

      <div className="relative z-[1] mt-[14px] grid grid-cols-[68px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[68px_minmax(0,1fr)_auto]">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 w-[68px] items-center justify-center rounded-[3px] bg-[#ff1c1c] shadow-[0_0_14px_rgba(255,28,28,0.4)] transition hover:brightness-110"
            aria-label="Play"
          >
            {PlayInner}
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex h-14 w-[68px] items-center justify-center rounded-[3px] bg-[#e97848]/75 shadow-[0_0_18px_rgba(233,120,72,0.42)] transition disabled:cursor-not-allowed"
            aria-label="Play"
            title="No video URL"
          >
            {PlayInner}
          </button>
        )}

        <div className="min-w-0">
          <div className="truncate text-[20px] font-bold tracking-[0.02em] text-[#f4f1e8]">{displayTitle}</div>
          <div className="mt-[9px] flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.84rem] uppercase tracking-[0.08em] text-[#8b857b]">
            <span>
              <span className="text-[#f4f1e8]">{displayViews}</span>{" "}
              <span>views</span>
            </span>
            <span>
              <span className="text-[#f4f1e8]">{displayLikes}</span>{" "}
              <span>likes</span>
            </span>
            <span>
              <span className="text-[#f4f1e8]">{displayComments}</span>{" "}
              <span>comments</span>
            </span>
          </div>
        </div>

        <div className="col-span-2 text-left text-[0.76rem] uppercase tracking-[0.14em] text-[#8d877e] sm:col-span-1 sm:text-right">{displayAge}</div>
      </div>
    </div>
  );
}
