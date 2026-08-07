import Link from "next/link";
import { LayoutDashboard, Dumbbell, Library, TrendingUp } from "lucide-react";

const navItems = [
  { href: "/qg", label: "QG", icon: LayoutDashboard },
  { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/progression", label: "Progression", icon: TrendingUp },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-gymx-bg">
      <main className="flex-1">{children}</main>
      <nav className="hud-panel mx-2 mb-2 px-2 py-1 flex justify-around items-center safe-area-bottom">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 py-1 px-3 text-gymx-muted hover:text-gymx-cyan transition-colors"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-display">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
