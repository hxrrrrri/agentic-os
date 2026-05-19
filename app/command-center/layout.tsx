export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cc-root page-enter rounded-[3px] border border-[#1f1d1c] bg-[#000000] text-[#f4f1e8]">
      {children}
    </div>
  );
}
