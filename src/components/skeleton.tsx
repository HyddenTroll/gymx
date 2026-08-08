export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      <div className="h-4 rounded-lg" style={{ backgroundColor: "var(--color-gymx-border)", width: "60%" }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded-lg" style={{ backgroundColor: "var(--color-gymx-border)", width: `${80 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      <div className="h-4 rounded-lg" style={{ backgroundColor: "var(--color-gymx-border)", width: "40%" }} />
      <div className="h-32 rounded-xl" style={{ backgroundColor: "var(--color-gymx-border)" }} />
    </div>
  );
}

export function SkeletonNav() {
  return (
    <div className="flex justify-around py-3 px-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="w-5 h-5 rounded" style={{ backgroundColor: "var(--color-gymx-border)" }} />
          <div className="w-8 h-2 rounded" style={{ backgroundColor: "var(--color-gymx-border)" }} />
        </div>
      ))}
    </div>
  );
}
