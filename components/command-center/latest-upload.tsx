interface LatestUploadProps {
  title?: string;
  views?: string;
  likes?: string;
  comments?: string;
  age?: string;
}

export function LatestUpload({
  title = "YouTube not connected",
  views = "-",
  likes = "-",
  comments = "-",
  age = "NO API KEY",
}: LatestUploadProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[3px] border border-[#5a1818]/60 p-3"
      style={{
        background:
          "linear-gradient(90deg, rgba(255,28,28,0.10) 0%, rgba(40,10,10,0.02) 35%, transparent 100%), #110a09",
      }}
    >
      <span className="absolute right-2 top-2 h-[6px] w-[6px] rounded-full bg-[#79a875] shadow-[0_0_6px_#79a875]" />

      <div className="text-[0.56rem] uppercase tracking-[0.18em] text-[#a8a29a]">Latest Upload</div>

      <div className="mt-2 grid grid-cols-[44px_1fr_auto] items-center gap-3">
        <button
          type="button"
          tabIndex={-1}
          className="flex h-9 w-11 items-center justify-center rounded-[4px] bg-[#ff1c1c] shadow-[0_0_14px_rgba(255,28,28,0.4)] transition hover:brightness-110"
          aria-label="Play"
        >
          <svg viewBox="0 0 24 24" width="14" height="14"><polygon points="9,6 19,12 9,18" fill="#fff" /></svg>
        </button>

        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold tracking-[0.02em] text-[#f4f1e8]">{title}</div>
          <div className="mt-1 flex items-center gap-3 text-[0.62rem] uppercase tracking-[0.12em] text-[#8b857b]">
            <span>
              <span className="text-[#f4f1e8]">{views}</span>{" "}
              <span>views</span>
            </span>
            <span>
              <span className="text-[#f4f1e8]">{likes}</span>{" "}
              <span>likes</span>
            </span>
            <span>
              <span className="text-[#f4f1e8]">{comments}</span>{" "}
              <span>comments</span>
            </span>
          </div>
        </div>

        <div className="text-right text-[0.58rem] uppercase tracking-[0.18em] text-[#6f6a61]">{age}</div>
      </div>
    </div>
  );
}
