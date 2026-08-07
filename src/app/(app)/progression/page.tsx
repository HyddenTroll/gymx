"use client";

import { useEffect, useState } from "react";
import { getPoidsCorps, getForceMax } from "@/lib/dashboard/dashboard-service";
import { Trophy, Weight, TrendingUp, Activity } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/qg", label: "QG", icon: Activity },
  { href: "/seance", label: "Séance", icon: TrendingUp },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Weight },
  { href: "/progression", label: "Progression", icon: Trophy },
];

export default function ProgressionPage() {
  const [poidsData, setPoidsData] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pc, fm] = await Promise.all([getPoidsCorps(), getForceMax()]);
      setPoidsData(pc); setRecords(fm); setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-dvh bg-gymx-bg flex items-center justify-center" style={{ minHeight: "100dvh" }}>
      <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-gymx-bg flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 safe-area-top">
        <header className="pt-1">
          <h1 className="font-display text-lg text-gymx-cyan">Progression</h1>
          <p className="text-gymx-muted text-xs">Poids du corps et records (PR)</p>
        </header>

        <div className="hud-panel p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Weight className="w-4 h-4 text-gymx-cyan shrink-0" />
            <h2 className="text-sm text-gymx-text">Poids du corps</h2>
          </div>
          {poidsData.length === 0 ? (
            <p className="text-xs text-gymx-muted leading-relaxed">Ajoute ton poids depuis le QG pour voir la courbe.</p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="font-display text-3xl text-gymx-cyan">{poidsData[0].poids}</span>
                <span className="text-sm text-gymx-muted mb-1">kg</span>
                {poidsData.length > 1 && (
                  <span className={`text-xs mb-1 ${poidsData[0].poids > poidsData[poidsData.length - 1].poids ? "text-gymx-cyan" : "text-gymx-magenta"}`}>
                    {poidsData[0].poids > poidsData[poidsData.length - 1].poids ? "+" : ""}
                    {(poidsData[0].poids - poidsData[poidsData.length - 1].poids).toFixed(1)} kg
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {poidsData.slice(0, 10).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-gymx-muted">{new Date(d.date).toLocaleDateString("fr-FR")}</span>
                    <span className="text-gymx-text font-display">{d.poids} kg</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="hud-panel p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-gymx-magenta shrink-0" />
            <h2 className="text-sm text-gymx-text">Records (PR)</h2>
          </div>
          {records.length === 0 ? (
            <p className="text-xs text-gymx-muted leading-relaxed">Aucun record pour l&apos;instant. Termine ta première séance !</p>
          ) : (
            <div className="space-y-2">
              {records.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex-1 min-w-0 mr-2">
                    <span className="text-sm text-gymx-text">{r.nom}</span>
                    <p className="text-[10px] text-gymx-muted leading-tight">Meilleure série : {r.charge} kg × {r.reps} reps</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-display text-lg text-gymx-magenta">{r.rm}</span>
                    <span className="text-[10px] text-gymx-muted ml-1">kg estimé</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="sticky bottom-0 hud-panel mx-2 mb-1 px-1 py-1 flex justify-around items-center z-50" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-gymx-muted active:text-gymx-cyan transition-colors touch-target">
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-display">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
