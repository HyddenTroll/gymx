export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-gymx-bg">
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
