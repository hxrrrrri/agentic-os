import { VaultRail } from "@/components/command-center/vault-rail";

export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-180px)] grid-cols-[34px_220px_1fr] gap-0 overflow-hidden rounded-[3px] border border-[#2a302c] bg-[#0c0e0b]">
      <ObsidianRibbon />
      <VaultRail />
      <div className="min-w-0 overflow-y-auto thin-scrollbar">{children}</div>
    </div>
  );
}

function ObsidianRibbon() {
  const icons = [
    <FileEditIcon key="edit" />,
    <FolderPlusIcon key="folderplus" />,
    <UploadIcon key="upload" />,
    <SquareIcon key="square" />,
    <XIcon key="x" />,
    null,
    <FilesIcon key="files" />,
    <ListIcon key="list" />,
    <SearchIcon key="search" />,
    <BookmarkIcon key="bookmark" />,
    <SquareStackIcon key="stack" />,
    <ChevronRightIcon key="cr" />,
    <CalendarIcon key="cal" />,
    <HashIcon key="hash" />,
    <NetworkIcon key="net" />,
    <LayoutIcon key="layout" />,
  ];
  return (
    <div className="flex flex-col items-center gap-[10px] border-r border-[#1d211b] bg-[#0a0c09] py-3">
      {icons.map((icon, i) =>
        icon ? (
          <button
            key={i}
            type="button"
            className="flex h-5 w-5 items-center justify-center text-[#6f6a61] transition hover:text-[#e86f3a]"
            tabIndex={-1}
            aria-hidden
          >
            {icon}
          </button>
        ) : (
          <div key={i} className="h-2 w-3 border-t border-[#1d211b]" />
        ),
      )}
    </div>
  );
}

function ico(props: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      {props.children}
    </svg>
  );
}
const FileEditIcon = () => ico({ children: (<><path d="M3 13V3h6l4 4v6H3z"/><path d="M9 3v4h4"/></>) });
const FolderPlusIcon = () => ico({ children: (<><path d="M2 5h4l1 1.5h7V13H2z"/><path d="M8 8.5v3M6.5 10h3"/></>) });
const UploadIcon = () => ico({ children: (<><path d="M8 11V3M5 6l3-3 3 3"/><path d="M3 13h10"/></>) });
const SquareIcon = () => ico({ children: (<rect x="3" y="3" width="10" height="10" rx="1"/>) });
const XIcon = () => ico({ children: (<><path d="M4 4l8 8M12 4l-8 8"/></>) });
const FilesIcon = () => ico({ children: (<><path d="M5 3h5l3 3v7H5z"/><path d="M3 5v8h7"/></>) });
const ListIcon = () => ico({ children: (<><path d="M3 4h10M3 8h10M3 12h10"/></>) });
const SearchIcon = () => ico({ children: (<><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></>) });
const BookmarkIcon = () => ico({ children: (<path d="M5 3h6v10l-3-2-3 2z"/>) });
const SquareStackIcon = () => ico({ children: (<><rect x="3" y="5" width="8" height="8" rx="1"/><path d="M5 3h8v8"/></>) });
const ChevronRightIcon = () => ico({ children: (<path d="M6 4l4 4-4 4"/>) });
const CalendarIcon = () => ico({ children: (<><rect x="2.5" y="4" width="11" height="9" rx="1"/><path d="M5 2v3M11 2v3M2.5 7h11"/></>) });
const HashIcon = () => ico({ children: (<><path d="M3 6h10M3 10h10M6 3l-1 10M11 3l-1 10"/></>) });
const NetworkIcon = () => ico({ children: (<><circle cx="8" cy="4" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><path d="M8 5.5L4.8 10.6M8 5.5l3.2 5.1M5.5 12h5"/></>) });
const LayoutIcon = () => ico({ children: (<><rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="M6 3v10M2.5 7h3.5"/></>) });
