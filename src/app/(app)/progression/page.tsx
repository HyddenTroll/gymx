"use client";

import { useEffect, useState } from "react";
import { getPoidsCorps, getForceMax } from "@/lib/dashboard/dashboard-service";
import { Trophy, Weight, BarChart3, Dumbbell, Library, TrendingUp, User } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 },
  { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/profil", label: "Profil", icon: User },
];

export default function ProgressionPage() {
  const [poidsData, setPoidsData] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = "/progression";

  useEffect(() => {
    (async () => {
      const [pc, fm] = await Promise.all([getPoidsCorps(), getForceMax()]);
      setPoidsData(pc); setRecords(fm); setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement…</p>
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="pt-1">
          <h1 className="card-title">Progression</h1>
          <p className="label">Poids du corps et records (PR)</p>
        </header>

        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Weight className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
            <p className="label">Poids du corps</p>
          </div>
          {poidsData.length === 0 ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-gymx-muted)" }}>
              Ajoute ton poids depuis le QG pour voir ta courbe.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="hero-value" style={{ fontSize: "2rem" }}>{poidsData[0].poids}</span>
                <span className="text-sm mb-1" style={{ color: "var(--color-gymx-muted)" }}>kg</span>
                {poidsData.length > 1 && (
                  <span className="text-xs mb-1 font-semibold" style={{
                    color: poidsData[0].poids >= poidsData[poidsData.length - 1].poids ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)"
                  }}>
                    {poidsData[0].poids >= poidsData[poidsData.length - 1].poids ? "+" : ""}
                    {(poidsData[0].poids - poidsData[poidsData.length - 1].poids).toFixed(1)} kg
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {poidsData.slice(0, 10).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-0.5">
                    <span style={{ color: "var(--color-gymx-muted)" }}>{new Date(d.date).toLocaleDateString("fr-FR")}</span>
                    <span className="font-mono font-medium" style={{ color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>{d.poids} kg</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-accent)" }} />
            <p className="label">Records <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(PR)</span></p>
          </div>
          {records.length === 0 ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-gymx-muted)" }}>
              Tes records apparaîtront ici dès ta première séance loguée.
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)", color: "var(--color-gymx-text)" }}>{r.nom}</span>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-gymx-muted)" }}>
                      Meilleure série&nbsp;: <span className="font-mono" style={{ fontFamily: "var(--font-mono)" }}>{r.charge} kg × {r.reps} reps</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="hero-value" style={{ fontSize: "1.5rem", color: "var(--color-gymx-accent)" }}>{r.rm}</span>
                    <span className="text-xs ml-1" style={{ color: "var(--color-gymx-muted)" }}>kg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="sticky bottom-0  border-t px-2 py-1 flex justify-around items-center z-50"
        style={{ borderColor: "var(--color-gymx-border)", paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors touch-target"
              style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
              <item.icon className="w-5 h-5" style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }} />
              <span className="text-[10px] font-semibold tracking-[0.04em]" style={{ fontFamily: "var(--font-body)" }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
