"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPoidsCorps, getForceMax } from "@/lib/dashboard/dashboard-service";
import { Trophy, Weight, TrendingUp } from "lucide-react";

export default function ProgressionPage() {
  const [poidsData, setPoidsData] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pc, fm] = await Promise.all([getPoidsCorps(), getForceMax()]);
      setPoidsData(pc);
      setRecords(fm);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh bg-gymx-bg flex items-center justify-center">
        <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gymx-bg p-4 space-y-4 safe-area-bottom">
      <header className="pt-2">
        <h1 className="font-display text-xl text-gymx-cyan">Progression</h1>
        <p className="text-gymx-muted text-xs">Poids du corps &amp; records (PR)</p>
      </header>

      {/* POIDS DU CORPS */}
      <div className="hud-panel p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Weight className="w-4 h-4 text-gymx-cyan" />
          <h2 className="text-sm text-gymx-text">Poids du corps</h2>
        </div>
        {poidsData.length === 0 ? (
          <p className="text-xs text-gymx-muted">
            Ajoute ton poids depuis le QG pour voir la courbe.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className="font-display text-3xl text-gymx-cyan">
                {poidsData[0].poids}
              </span>
              <span className="text-sm text-gymx-muted mb-1">kg</span>
              {poidsData.length > 1 && (
                <span className={`text-xs mb-1 ${
                  poidsData[0].poids > poidsData[poidsData.length - 1].poids
                    ? "text-gymx-cyan" : "text-gymx-magenta"
                }`}>
                  {poidsData[0].poids > poidsData[poidsData.length - 1].poids ? "+" : ""}
                  {(poidsData[0].poids - poidsData[poidsData.length - 1].poids).toFixed(1)} kg
                </span>
              )}
            </div>
            <div className="space-y-1">
              {poidsData.slice(0, 10).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gymx-muted">{new Date(d.date).toLocaleDateString("fr-FR")}</span>
                  <span className="text-gymx-text font-display">{d.poids} kg</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* RECORDS */}
      <div className="hud-panel p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gymx-magenta" />
          <h2 className="text-sm text-gymx-text">
            Records (PR)
          </h2>
        </div>
        {records.length === 0 ? (
          <p className="text-xs text-gymx-muted">
            Aucun record pour l&apos;instant. Termine ta première séance&nbsp;!
          </p>
        ) : (
          <div className="space-y-2">
            {records.map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gymx-text">{r.nom}</span>
                  <p className="text-[10px] text-gymx-muted">
                    Meilleure série : {r.charge} kg × {r.reps} reps
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-display text-lg text-gymx-magenta">{r.rm}</span>
                  <span className="text-[10px] text-gymx-muted ml-1">kg estimé</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
