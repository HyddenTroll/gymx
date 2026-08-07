"use client";

import { useEffect, useState } from "react";
import { getForceMax, getVolumeSemaine, getFrequenceMuscles, getEffortMoyen, getRegularite, getPoidsCorps } from "@/lib/dashboard/dashboard-service";
import { calculerProjections, type Projection } from "@/lib/dashboard/projections";
import { createClient } from "@/lib/supabase/client";
import { Zap, Trophy, BarChart3, Activity, Clock, Weight, AlertTriangle, Target, Dumbbell, Library, TrendingUp, User } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 },
  { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/profil", label: "Profil", icon: User },
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
  const [projections, setProjections] = useState<Projection[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = "/qg";

  useEffect(() => {
    (async () => {
      const [fm, vol, fr, ef, reg, pc] = await Promise.all([
        getForceMax(), getVolumeSemaine(), getFrequenceMuscles(),
        getEffortMoyen(), getRegularite(), getPoidsCorps()]);
      setForceMax(fm); setVolume(vol); setFreq(fr); setEffort(ef); setRegularite(reg); setPoidsCorps(pc);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: g } = await supabase.from("gamification").select("*").eq("user_id", user.id).maybeSingle();
        if (g) setGamification(g);
        const { data: p } = await supabase.from("profil").select("*").eq("user_id", user.id).maybeSingle();
        if (p) setProfil(p);
        const projs = await calculerProjections(user.id);
        setProjections(projs);
      }
      setLoading(false);
    })();
  }, [supabase]);

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement…</p>
    </div>
  );

  const xpProgress = gamification ? ((gamification.xp % 100) / 100) * 100 : 0;
  const niveaux = ["Recrue", "Apprenti", "Soldat", "Combattant", "Vétéran", "Élite", "Maître", "Légende"];
  const rang = gamification ? niveaux[Math.min(gamification.niveau - 1, niveaux.length - 1)] : "Recrue";

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="card-title">QG</h1>
            <p className="label">Tableau de bord</p>
          </div>
          <div className="flex items-center gap-2">
            {profil && (
              <div className="text-right">
                <p className="label" style={{ fontSize: "10px" }}>{profil.niveau}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-gymx-muted)" }}>
                  {profil.objectif === "force" ? "Force" : profil.objectif === "muscle" ? "Hypertrophie" : "Recomposition"} · {profil.jours_par_semaine}j/sem
                </p>
              </div>
            )}
          </div>
        </header>

        {gamification && (
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-text)" }} />
                <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--color-gymx-text)" }}>
                  {rang} · Niveau {gamification.niveau}
                </span>
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-muted)" }}>
                {gamification.xp % 100}/100 XP
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${xpProgress}%`, backgroundColor: "var(--color-gymx-fill-strong)" }} />
            </div>
            {gamification.streak > 0 && (
              <p className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{gamification.streak} séances d&apos;affilée</p>
            )}
          </div>
        )}

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="label">Force max estimée <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(1RM)</span></p>
            {forceMax.length > 0 && <Trophy className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-accent)" }} />}
          </div>
          {forceMax.length === 0 ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-gymx-muted)" }}>
              Termine ta première séance pour voir ta force max estimée (1RM).
            </p>
          ) : (
            <div className="space-y-2">
              {forceMax.slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>{f.nom}</span>
                  <span className="hero-value text-xl">
                    {f.rm}
                    <span className="text-xs font-mono font-medium ml-1" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>kg</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 space-y-1">
            <p className="label">Régularité</p>
            <span className="hero-value" style={{ fontSize: "2rem" }}>{regularite.taux}%</span>
            {regularite.streak > 0 && <p className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{regularite.streak}j de suite</p>}
          </div>
          <div className="card p-4 space-y-1">
            <p className="label">Séances</p>
            <span className="hero-value" style={{ fontSize: "2rem" }}>{regularite.streak}</span>
            <p className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>faites</p>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <p className="label">Travail total <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(volume)</span></p>
          {volume.length === 0 ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-gymx-muted)" }}>
              Aucune série cette semaine. Lance ta séance du jour pour commencer à remplir la zone.
            </p>
          ) : (
            <div className="space-y-2">
              {volume.map((v: any, i: number) => {
                const isIdeal = v.status === "ideal";
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: "var(--color-gymx-muted)" }}>{v.groupe}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--color-gymx-text)" }}>{v.sets} séries</span>
                        {isIdeal && <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-accent)" }}>Idéal</span>}
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min((v.sets / 20) * 100, 100)}%`,
                        backgroundColor: isIdeal ? "var(--color-gymx-accent)" : "var(--color-gymx-fill-strong)"
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>Zone idéale&nbsp;: 10-20 séries/muscle par semaine</p>
        </div>

        {freq.length > 0 && (
          <div className="card p-4 space-y-2">
            <p className="label">Fréquence cette semaine</p>
            <div className="space-y-1.5">
              {freq.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--color-gymx-muted)" }}>{f.groupe}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--color-gymx-text)" }}>{f.fois}×</span>
                    {f.ok ? <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-accent)" }}>✓ ≥2</span> : <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>✗</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {effort && effort.total > 0 && (
          <div className="card p-4 space-y-2">
            <p className="label">Effort moyen <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(RPE)</span></p>
            <div className="flex items-center gap-2">
              <span className="hero-value" style={{ fontSize: "2rem" }}>{effort.moyenne}</span>
              <span className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>/10</span>
              {effort.trop_dur && (
                <div className="flex items-center gap-1 ml-auto">
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-accent)" }} />
                  <span className="text-xs" style={{ color: "var(--color-gymx-accent)" }}>Trop de séances à la limite</span>
                </div>
              )}
            </div>
          </div>
        )}

        {poidsCorps.length > 0 && (
          <div className="card p-4 space-y-2">
            <p className="label">Poids du corps</p>
            <div className="flex items-end gap-2">
              <span className="hero-value" style={{ fontSize: "2rem" }}>{poidsCorps[0].poids}</span>
              <span className="text-sm mb-1" style={{ color: "var(--color-gymx-muted)" }}>kg</span>
              {poidsCorps.length > 1 && (
                <span className="text-xs mb-1 font-semibold" style={{
                  color: poidsCorps[0].poids >= poidsCorps[poidsCorps.length - 1].poids ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)"
                }}>
                  {poidsCorps[0].poids >= poidsCorps[poidsCorps.length - 1].poids ? "+" : ""}
                  {(poidsCorps[0].poids - poidsCorps[poidsCorps.length - 1].poids).toFixed(1)} kg
                </span>
              )}
            </div>
          </div>
        )}

        {projections.length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="label">Projections <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(rythme estimé)</span></p>
            {projections.map((p, i) => {
              const tendanceIcon = p.tendance === "hausse" ? "↗" : p.tendance === "baisse" ? "↘" : "→";
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: "var(--color-gymx-muted)" }}>{p.nom}</span>
                      {p.alerte_plateau && <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--color-gymx-accent)" }} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono" style={{ fontFamily: "var(--font-mono)", color: "var(--color-gymx-text)" }}>{p.charge_actuelle} kg</span>
                      <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{tendanceIcon} {p.taux_hebdo}/sem</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min((p.projection_8sem / (p.charge_actuelle * 2)) * 100, 100)}%`, backgroundColor: "var(--color-gymx-fill-strong)" }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: "var(--color-gymx-muted)" }}>
                    <span>Maintenant · {p.charge_actuelle} kg</span>
                    <span>4 sem · {p.projection_4sem} kg</span>
                    <span>8 sem · {p.projection_8sem} kg</span>
                  </div>
                  {p.alerte_deload && (
                    <p className="text-xs font-semibold" style={{ color: "var(--color-gymx-accent)" }}>
                      ⚠ Semaine allégée (deload) recommandée — échecs répétés
                    </p>
                  )}
                  {p.alerte_plateau && !p.alerte_deload && (
                    <p className="text-xs" style={{ color: "var(--color-gymx-accent)" }}>
                      Plateau détecté — envisage une semaine allégée
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {forceMax.length === 0 && volume.length === 0 && !effort && (
          <div className="card p-8 text-center space-y-2">
            <BarChart3 className="w-8 h-8 mx-auto" style={{ color: "var(--color-gymx-fill)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-text)" }}>Bienvenue sur GYMX</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-gymx-muted)" }}>
              Termine ta première séance pour voir tes données apparaître ici.
            </p>
          </div>
        )}
      </div>

      <nav className="sticky bottom-0  border-t px-2 py-1 flex justify-around items-center z-50" style={{ borderColor: "var(--color-gymx-border)", paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
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
