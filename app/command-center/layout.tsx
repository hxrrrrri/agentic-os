export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cc-root overflow-hidden bg-[#000000] text-[#f4f1e8]">
      {children}
    </div>
  );
}
