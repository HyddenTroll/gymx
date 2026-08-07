"use client";

import { useEffect, useState } from "react";
import {
  getForceMax, getVolumeSemaine, getFrequenceMuscles,
  getEffortMoyen, getRegularite, getPoidsCorps,
} from "@/lib/dashboard/dashboard-service";
import { createClient } from "@/lib/supabase/client";
import { Zap, Trophy, BarChart3, Activity, Clock, Weight, AlertTriangle, Target } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 },
  { href: "/seance", label: "Séance", icon: Zap },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Activity },
  { href: "/progression", label: "Progression", icon: Trophy },
];

export default function QGPage() {
  const supabase = createClient();
  const [forceMax, setForceMax] = useState<any[]>([]);
  const [volume, setVolume] = useState<any[]>([]);
  const [freq, setFreq] = useState<any[]>([]);
  const [effort, setEffort] = useState<{ moyenne: number; total: number; trop_dur: boolean } | null>(null);
  const [regularite, setRegularite] = useState<{ streak: number; taux: number }>({ streak: 0, taux: 0 });
  const [poidsCorps, setPoidsCorps] = useState<any[]>([]);
  const [gamification, setGamification] = useState<any>(null);
  const [profil, setProfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [fm, vol, fr, ef, reg, pc] = await Promise.all([
        getForceMax(), getVolumeSemaine(), getFrequenceMuscles(),
        getEffortMoyen(), getRegularite(), getPoidsCorps(),
      ]);
      setForceMax(fm); setVolume(vol); setFreq(fr); setEffort(ef);
      setRegularite(reg); setPoidsCorps(pc);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: g } = await supabase.from("gamification").select("*").eq("user_id", user.id).maybeSingle();
        if (g) setGamification(g);
        const { data: p } = await supabase.from("profil").select("*").eq("user_id", user.id).maybeSingle();
        if (p) setProfil(p);
      }
      setLoading(false);
    })();
  }, [supabase]);

  if (loading) return (
    <div className="min-h-dvh bg-gymx-bg flex items-center justify-center" style={{ minHeight: "100dvh" }}>
      <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
    </div>
  );

  const xpProgress = gamification ? ((gamification.xp % 100) / 100) * 100 : 0;
  const nextLevel = gamification ? gamification.niveau + 1 : 1;

  return (
    <div className="min-h-dvh bg-gymx-bg flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 safe-area-top">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg text-gymx-cyan">QG</h1>
            <p className="text-gymx-muted text-xs">Tableau de bord</p>
          </div>
          {profil && (
            <div className="text-right">
              <p className="text-[10px] font-display text-gymx-violet leading-tight">
                {profil.objectif === "force" ? "FORCE" : profil.objectif === "muscle" ? "HYPERTROPHIE" : "RECOMPOSITION"}
              </p>
              <p className="text-[9px] text-gymx-muted">{profil.niveau} · {profil.jours_par_semaine}j/sem</p>
            </div>
          )}
        </header>

        {gamification && (
          <div className="hud-panel p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-gymx-cyan shrink-0" />
                <span className="font-display text-sm text-gymx-text">Niveau {gamification.niveau}</span>
              </div>
              <span className="text-[10px] text-gymx-muted">Niv. {nextLevel} · {gamification.xp % 100}/100 XP</span>
            </div>
            <div className="h-1.5 bg-gymx-bg rounded-full overflow-hidden">
              <div className="h-full bg-gymx-cyan rounded-full animate-xp-fill" style={{ width: `${xpProgress}%` }} />
            </div>
            {gamification.streak > 0 && (
              <p className="text-[10px] text-gymx-muted">🔥 {gamification.streak} séances d&apos;affilée</p>
            )}
          </div>
        )}

        <div className="hud-panel p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-gymx-text">Force max estimée <span className="text-technical">(1RM)</span></h2>
            <Trophy className="w-4 h-4 text-gymx-magenta shrink-0" />
          </div>
          {forceMax.length === 0 ? (
            <p className="text-xs text-gymx-muted leading-relaxed">Logue tes séances pour voir ta force max estimée.</p>
          ) : (
            <div className="space-y-1">
              {forceMax.slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gymx-muted truncate mr-2">{f.nom}</span>
                  <span className="font-display text-sm text-gymx-cyan shrink-0">
                    {f.rm} kg <span className="text-technical">({f.charge}×{f.reps})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="hud-panel p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-gymx-violet shrink-0" />
              <span className="text-xs text-gymx-muted">Régularité</span>
            </div>
            <span className="font-display text-lg text-gymx-violet">{regularite.taux}%</span>
            {regularite.streak > 0 && <p className="text-[10px] text-gymx-muted">🔥 {regularite.streak}j</p>}
          </div>
          <div className="hud-panel p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-gymx-magenta shrink-0" />
              <span className="text-xs text-gymx-muted">Séances faites</span>
            </div>
            <span className="font-display text-lg text-gymx-magenta">{regularite.streak}</span>
          </div>
        </div>

        <div className="hud-panel p-3 space-y-1.5">
          <h2 className="text-sm text-gymx-text">Travail total <span className="text-technical">(volume)</span></h2>
          {volume.length === 0 ? (
            <p className="text-xs text-gymx-muted leading-relaxed">Aucune donnée cette semaine.</p>
          ) : (
            <div className="space-y-1">
              {volume.map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gymx-muted">{v.groupe}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-gymx-text">{v.sets} séries</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      v.status === "trop_peu" ? "bg-gymx-magenta/20 text-gymx-magenta" :
                      v.status === "ideal" ? "bg-gymx-cyan/20 text-gymx-cyan" : "bg-gymx-magenta/20 text-gymx-magenta"
                    }`}>{v.status === "trop_peu" ? "Trop peu" : v.status === "ideal" ? "Idéal" : "Trop"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-technical">Zone idéale: 10-20 séries/muscle par semaine</p>
        </div>

        {freq.length > 0 && (
          <div className="hud-panel p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-gymx-cyan shrink-0" />
              <h2 className="text-sm text-gymx-text">Fréquence cette semaine</h2>
            </div>
            <div className="space-y-1">
              {freq.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gymx-muted">{f.groupe}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gymx-text">{f.fois}×</span>
                    {f.ok ? <span className="text-[10px] text-gymx-cyan">✓ ≥2</span> : <span className="text-[10px] text-gymx-magenta">✗</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {effort && effort.total > 0 && (
          <div className="hud-panel p-3 space-y-1.5">
            <h2 className="text-sm text-gymx-text">Effort moyen <span className="text-technical">(RPE)</span></h2>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl text-gymx-violet">{effort.moyenne}</span>
              <span className="text-xs text-gymx-muted">/10</span>
              {effort.trop_dur && (
                <div className="flex items-center gap-1 ml-auto">
                  <AlertTriangle className="w-3 h-3 text-gymx-magenta shrink-0" />
                  <span className="text-[10px] text-gymx-magenta leading-tight">Trop de séances À la limite/Impossible</span>
                </div>
              )}
            </div>
          </div>
        )}

        {poidsCorps.length > 0 && (
          <div className="hud-panel p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Weight className="w-3 h-3 text-gymx-cyan shrink-0" />
              <h2 className="text-sm text-gymx-text">Poids du corps</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl text-gymx-cyan">{poidsCorps[0].poids}</span>
              <span className="text-xs text-gymx-muted">kg</span>
              {poidsCorps.length > 1 && (
                <span className={`text-xs ${poidsCorps[0].poids > poidsCorps[poidsCorps.length - 1].poids ? "text-gymx-magenta" : "text-gymx-cyan"}`}>
                  {poidsCorps[0].poids > poidsCorps[poidsCorps.length - 1].poids ? "+" : ""}
                  {(poidsCorps[0].poids - poidsCorps[poidsCorps.length - 1].poids).toFixed(1)} kg
                </span>
              )}
            </div>
          </div>
        )}

        {forceMax.length === 0 && volume.length === 0 && effort === null && (
          <div className="hud-panel p-6 text-center space-y-2">
            <BarChart3 className="w-8 h-8 text-gymx-muted mx-auto" />
            <p className="text-gymx-muted text-sm">Bienvenue sur GYMX !</p>
            <p className="text-gymx-muted text-xs leading-relaxed">Complète ta première séance pour voir tes données apparaître ici.</p>
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 hud-panel mx-2 mb-1 px-1 py-1 flex justify-around items-center z-50" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-gymx-cyan active:text-gymx-cyan transition-colors touch-target">
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-display">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
