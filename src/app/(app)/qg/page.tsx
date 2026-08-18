"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { getForceMax, getVolumeSemaine, getFrequenceMuscles, getEffortMoyen, getRegularite, getPoidsCorps, getFatigueParMuscle, getStaleExercices, getProgressTrend } from "@/lib/dashboard/dashboard-service";
import CalendrierWidget from "@/components/calendrier-widget";
import { calculerProgression, type ProgressionSimple } from "@/lib/dashboard/projections";
import { verifierCycle, executerDeload } from "@/lib/programme/cycles";
import { getPushPullRatio, getIntensiteDistribution, getPointsFaibles, labelSousRegion } from "@/lib/dashboard/analytics";
import { createClient } from "@/lib/supabase/client";
import { BADGES, badgeIcon, getNiveauLabel } from "@/lib/gamification/gamification-service";
import { SkeletonCard, SkeletonChart } from "@/components/skeleton";
import { Zap, Trophy, BarChart3, Activity, Clock, Weight, AlertTriangle, Target, Dumbbell, Library, TrendingUp, User, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
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
  const pathname = usePathname();
  const [calRefreshKey, setCalRefreshKey] = useState(0);
  const [forceMax, setForceMax] = useState<any[]>([]);
  const [volume, setVolume] = useState<any[]>([]);
  const [freq, setFreq] = useState<any[]>([]);
  const [effort, setEffort] = useState<{ moyenne: number; total: number; trop_dur: boolean; fatigue_score: number; tendance: "hausse" | "baisse" | "stable" } | null>(null);
  const [regularite, setRegularite] = useState<{ streak: number; taux: number; total: number }>({ streak: 0, taux: 0, total: 0 });
  const [poidsCorps, setPoidsCorps] = useState<any[]>([]);
  const [gamification, setGamification] = useState<any>(null);
  const [profil, setProfil] = useState<any>(null);
  const [projections, setProjections] = useState<ProgressionSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [goalModal, setGoalModal] = useState<{ exoId: string; nom: string; current: number } | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [programmeActif, setProgrammeActif] = useState<any>(null);
  const [cycleInfo, setCycleInfo] = useState<any>(null);
  const [deloading, setDeloading] = useState(false); const [message, setMessage] = useState("");
  const [pushPull, setPushPull] = useState<any>(null);
  const [intensite, setIntensite] = useState<any>(null);
  const [pointsFaibles, setPointsFaibles] = useState<any[]>([]);
  const [fatigueMuscles, setFatigueMuscles] = useState<any[]>([]);
  const [staleExercices, setStaleExercices] = useState<any[]>([]);
  const [trend, setTrend] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
      const [fm, vol, fr, ef, reg, pc] = await Promise.all([
        getForceMax(), getVolumeSemaine(), getFrequenceMuscles(),
        getEffortMoyen(), getRegularite(), getPoidsCorps()]);
      setForceMax(fm); setVolume(vol); setFreq(fr); setEffort(ef as any); setRegularite(reg); setPoidsCorps(pc);
      if (fm.length > 0) {
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: g } = await supabase.from("gamification").select("*").eq("user_id", user.id).maybeSingle();
        if (g) setGamification(g);
        const { data: p } = await supabase.from("profil").select("*").eq("user_id", user.id).maybeSingle();
        if (p) setProfil(p);
        const projs = await calculerProgression(user.id);
        setProjections(projs);

        const { data: prog } = await supabase.from("programme_actif").select("*").eq("user_id", user.id).maybeSingle();
        if (prog) {
          setProgrammeActif(prog);
          const ci = await verifierCycle(user.id);
          setCycleInfo(ci);
        }

        const [pp, int, pf, fmus, stale, tr] = await Promise.all([getPushPullRatio(user.id), getIntensiteDistribution(user.id), getPointsFaibles(user.id), getFatigueParMuscle(user.id), getStaleExercices(user.id), getProgressTrend(user.id)]);
        setPushPull(pp); setIntensite(int); setPointsFaibles(pf); setFatigueMuscles(fmus); setStaleExercices(stale); setTrend(tr);

        const saved = localStorage.getItem("gymx_goals");
        if (saved) setGoals(JSON.parse(saved));
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
    })();
    setCalRefreshKey((k) => k + 1);
  }, [supabase, pathname]);

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
                {programmeActif && (
                  <p className="text-[10px] mt-0.5 font-semibold" style={{ color: "var(--color-gymx-accent)" }}>
                    {programmeActif.nom}
                  </p>
                )}
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
            {gamification.badges && gamification.badges.length > 0 && (
              <>
                <div className="border-t pt-2" style={{ borderColor: "var(--color-gymx-border)" }} />
                <div className="flex flex-wrap gap-1.5">
                  {(gamification.badges as string[]).slice(-8).reverse().map((b: string) => {
                    const bg = BADGES.find((x) => x.id === b);
                    return (
                      <span key={b} className="text-[10px] font-semibold px-2 py-0.5 rounded-full touch-target"
                        style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}
                        title={bg?.desc || b}>
                        {bg ? `${bg.icone} ${bg.label}` : `⭐ ${b}`}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {message && <div className="card p-3 text-sm font-semibold text-center animate-fade-in" style={{ color: "var(--color-gymx-accent)" }}>{message}</div>}

        {cycleInfo && programmeActif && (
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 shrink-0" style={{ color: cycleInfo.deloadDue ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }} />
                <p className="label">
                  {cycleInfo.phase === "accumulation" ? "Accumulation" : cycleInfo.phase === "intensification" ? "Intensification" : "Deload"}
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}> — cycle {cycleInfo.cycleCourant}</span>
                </p>
              </div>
              <span className="text-xs font-semibold" style={{ color: cycleInfo.deloadDue ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
                Semaine {cycleInfo.phaseSemaine}/{cycleInfo.phaseTotal}
              </span>
            </div>
            <p className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>{cycleInfo.intensiteNote}</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="h-1 flex-1 rounded-full"
                  style={{ backgroundColor: s <= cycleInfo.phaseSemaine ? "var(--color-gymx-accent)" : "var(--color-gymx-fill)" }} />
              ))}
            </div>
            {cycleInfo.deloadDue && cycleInfo.phase !== "deload" && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-accent)" }} />
                <p className="text-xs flex-1" style={{ color: "var(--color-gymx-accent)" }}>
                  Deload recommandé la semaine prochaine
                </p>
                <button onClick={async () => {
                  setDeloading(true);
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) await executerDeload(user.id);
                  setDeloading(false);
                  setMessage("✓ Deload exécuté");
                  setTimeout(() => setMessage(""), 3000);
                }} disabled={deloading}
                  className="text-xs font-semibold px-3 py-2 rounded-xl touch-target disabled:opacity-30"
                  style={{ backgroundColor: "var(--color-gymx-accent)", color: "#0a0a0b" }}>
                  {deloading ? "…" : "Appliquer"}
                </button>
              </div>
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
          {forceMax.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {forceMax.slice(0, 5).map((f: any, i: number) => (
                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                  {f.nom} : {f.rm} kg
                </span>
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
            <span className="hero-value" style={{ fontSize: "2rem" }}>{regularite.total}</span>
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
                const statusColor = v.status === "mav" ? "var(--color-gymx-accent)" : v.status === "trop_peu" ? "var(--color-gymx-text)" : "var(--color-gymx-fill-strong)";
                const statusLabel = v.status === "trop_peu" ? "Sous MEV" : v.status === "mev" ? "MEV" : v.status === "mav" ? "MAV ✓" : v.status === "proche_mrv" ? "MRV ⚠" : "Trop";
                const barMax = v.mrv || 20;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: "var(--color-gymx-muted)" }}>{v.groupe}</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "var(--color-gymx-text)" }}>{v.sets} / {v.mav_min}-{v.mav_max}</span>
                        <span className="text-[9px] font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min((v.sets / barMax) * 100, 100)}%`,
                        backgroundColor: statusColor,
                      }} />
                    </div>
                    <div className="flex justify-between text-[8px]" style={{ color: "var(--color-gymx-muted)" }}>
                      <span>MEV {v.mev}</span>
                      <span>MAV {v.mav_min}-{v.mav_max}</span>
                      <span>MRV {v.mrv}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {trend && trend.exos.length > 0 && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
                <p className="label">Tendance</p>
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-muted)" }}>
                {trend.en_progression}/{trend.total} en progression
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
              <div className="h-full rounded-full" style={{
                width: `${(trend.en_progression / Math.max(1, trend.total)) * 100}%`,
                backgroundColor: trend.en_progression / Math.max(1, trend.total) >= 0.5 ? "var(--color-gymx-accent)" : "var(--color-gymx-text)",
              }} />
            </div>
            <div className="space-y-1.5">
              {trend.exos.map((exo: any, i: number) => {
                const fleche = exo.statut === "progression" ? "↑" : exo.statut === "regression" ? "↓" : "→";
                const couleur = exo.statut === "progression" ? "var(--color-gymx-accent)" : exo.statut === "regression" ? "var(--color-gymx-text)" : "var(--color-gymx-muted)";
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex-1 min-w-0 mr-2">
                      <span style={{ color: "var(--color-gymx-text)" }}>{exo.nom}</span>
                      <span className="text-[10px] ml-1.5" style={{ color: "var(--color-gymx-muted)" }}>
                        {exo.rm_avant} → {exo.rm_actuel} kg
                      </span>
                    </div>
                    <span className="font-semibold shrink-0" style={{ color: couleur, fontSize: "13px" }}>
                      {fleche} {exo.statut === "progression" ? "Progression" : exo.statut === "regression" ? "Régression" : exo.statut === "stagnation" ? "Stagnation" : "Stable"}
                    </span>
                  </div>
                );
              })}
            </div>
            {trend.tonnage_semaine > 0 && (
              <div className="border-t pt-2 text-[10px]" style={{ borderColor: "var(--color-gymx-border)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--color-gymx-muted)" }}>Tonnage semaine</span>
                  <span className="font-mono font-semibold" style={{ color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>
                    {(trend.tonnage_semaine / 1000).toFixed(1)}k kg
                  </span>
                </div>
                {trend.tonnage_avant > 0 && (
                  <div className="flex items-center justify-between mt-0.5">
                    <span style={{ color: "var(--color-gymx-muted)" }}>Semaine précédente</span>
                    <span className="font-mono" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>
                      {(trend.tonnage_avant / 1000).toFixed(1)}k kg
                      <span className="ml-1" style={{ color: trend.tonnage_semaine >= trend.tonnage_avant ? "var(--color-gymx-accent)" : "var(--color-gymx-text)" }}>
                        {trend.tonnage_semaine >= trend.tonnage_avant ? "↑" : "↓"}
                        {Math.round(((trend.tonnage_semaine - trend.tonnage_avant) / Math.max(1, trend.tonnage_avant)) * 100)}%
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {staleExercices.length > 0 && (
          <div className="card p-4 space-y-2">
            <p className="label">Variation suggérée</p>
            <p className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>Ces exos stagnent → change de variante</p>
            <div className="space-y-1.5">
              {staleExercices.map((s: any, i: number) => {
                const raison = s.chargeStable && s.rpeStable ? "Charge + RPE stables" : s.chargeStable ? "Charge bloquée" : "RPE élevé répété";
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-0.5">
                    <div>
                      <span style={{ color: "var(--color-gymx-text)" }}>{s.nom}</span>
                      <span className="text-[10px] ml-1.5" style={{ color: "var(--color-gymx-muted)" }}>({s.nbSeances} séances)</span>
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: "var(--color-gymx-accent)" }}>{raison}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              {poidsCorps.length > 1 && (() => {
                const delta = poidsCorps[0].poids - poidsCorps[poidsCorps.length - 1].poids;
                const signe = delta > 0 ? "+" : "";
                return (
                <span className="text-xs mb-1 font-semibold" style={{
                  color: delta >= 0 ? "var(--color-gymx-accent)" : "var(--color-gymx-text)"
                }}>
                  {signe}{delta.toFixed(1)} kg
                </span>
                );
              })()}
            </div>
            {poidsCorps.length > 2 && (
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...poidsCorps].reverse()}>
                    <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                    <YAxis domain={[(d: number) => Math.floor(d - 1), (d: number) => Math.ceil(d + 1)]} tick={{ fontSize: 8, fill: "var(--color-gymx-muted)" }} width={28} axisLine={false} tickLine={false} />
                    <Line type="monotone" dataKey="poids" stroke="var(--color-gymx-accent)" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {fatigueMuscles.length > 0 && (
          <div className="card p-4 space-y-2">
            <p className="label">Récupération par muscle</p>
            <div className="space-y-2">
              {fatigueMuscles.filter((m: any) => m.jours_depuis < 14).map((m: any) => {
                const couleur = m.recup_pct >= 100 ? "var(--color-gymx-accent)" : m.recup_pct >= 60 ? "var(--color-gymx-fill-strong)" : "var(--color-gymx-text)";
                return (
                  <div key={m.groupe} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--color-gymx-muted)" }}>{m.groupe}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold" style={{ color: couleur, fontFamily: "var(--font-mono)" }}>{m.recup_pct}%</span>
                        {m.dernier_rpe && <span className="text-[9px]" style={{ color: "var(--color-gymx-muted)" }}>RPE {m.dernier_rpe}</span>}
                      </div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(m.recup_pct, 100)}%`, backgroundColor: couleur }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {projections.length > 0 && (
          <div className="card p-4 space-y-3">
            <p className="label">Progression par exo <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(taper pour fixer un objectif)</span></p>
            {projections.map((p, i) => {
              const goal = goals[p.exercice_id];
              const goalWeeks = goal && p.moyenne_hebdo > 0 ? Math.round((goal - p.charge_actuelle) / p.moyenne_hebdo) : null;
              return (
                <div key={i} className="space-y-1.5 border-b pb-2 touch-target active:opacity-60" style={{ borderColor: "var(--color-gymx-border)" }}
                  onClick={() => setGoalModal({ exoId: p.exercice_id, nom: p.nom, current: p.charge_actuelle })}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: "var(--color-gymx-muted)" }}>{p.nom}</span>
                      {p.alerte_plateau && <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--color-gymx-accent)" }} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono" style={{ fontFamily: "var(--font-mono)", color: "var(--color-gymx-text)" }}>{p.charge_actuelle} kg</span>
                      {p.delta !== 0 && (
                        <span className="text-xs font-semibold" style={{ color: p.delta > 0 ? "var(--color-gymx-accent)" : "var(--color-gymx-text)" }}>
                          {p.delta > 0 ? "+" : ""}{p.delta}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>
                    <span>Dernière charge : {p.charge_precedente || "—"} kg</span>
                    {p.moyenne_hebdo > 0 && (
                      <span>· ~{p.moyenne_hebdo} kg/sem</span>
                    )}
                  </div>
                  {goal && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-semibold" style={{ color: p.charge_actuelle >= goal ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
                        {p.charge_actuelle >= goal ? "✓ Objectif atteint !" : `Objectif : ${goal} kg`}
                      </span>
                      {p.charge_actuelle < goal && (
                        <span style={{ color: "var(--color-gymx-muted)" }}>
                          {goalWeeks !== null ? `(~${goalWeeks} sem)` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {p.alerte_deload && (
                    <p className="text-xs font-semibold" style={{ color: "var(--color-gymx-accent)" }}>
                      ⚠ Semaine allégée recommandée — RPE élevé constant
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

        {pushPull && (
          <div className="card p-4 space-y-2">
            <p className="label">Equilibre push/pull</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
                <div className="h-full rounded-full" style={{ width: pushPull.pushPct + "%", backgroundColor: pushPull.equilibre ? "var(--color-gymx-fill-strong)" : "var(--color-gymx-accent)" }} />
              </div>
              <span className="text-xs font-semibold shrink-0" style={{ color: pushPull.equilibre ? "var(--color-gymx-muted)" : "var(--color-gymx-accent)" }}>
                {pushPull.pushPct}% push / {pushPull.pullPct}% pull
              </span>
            </div>
            {!pushPull.equilibre && <p className="text-xs" style={{ color: "var(--color-gymx-accent)" }}>Desequilibre detecte — ratio {pushPull.ratio}:1</p>}
          </div>
        )}

        {intensite && intensite.facile + intensite.moyen + intensite.dur + intensite.impossible > 0 && (
          <div className="card p-4 space-y-2">
            <p className="label">Repartition de l&apos;effort <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(RPE)</span></p>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div style={{ width: intensite.facile + "%", backgroundColor: "var(--color-gymx-fill)" }} />
              <div style={{ width: intensite.moyen + "%", backgroundColor: "var(--color-gymx-fill-strong)" }} />
              <div style={{ width: intensite.dur + "%", backgroundColor: "#8B5CF6" }} />
              <div style={{ width: intensite.impossible + "%", backgroundColor: "var(--color-gymx-accent)" }} />
            </div>
            <div className="flex justify-between text-[9px]" style={{ color: "var(--color-gymx-muted)" }}>
              <span>{intensite.facile}% Facile</span>
              <span>{intensite.moyen}% Modere</span>
              <span>{intensite.dur}% Dur</span>
              <span>{intensite.impossible}% Limite</span>
            </div>
            {intensite.impossible > 30 && (
              <p className="text-xs" style={{ color: "var(--color-gymx-accent)" }}>
                Attention : plus de 30% des series sont a la limite — envisage un deload
              </p>
            )}
          </div>
        )}

        {pointsFaibles.length > 0 && (
          <div className="card p-4 space-y-2">
            <p className="label">Points faibles <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(sous-regions negligees)</span></p>
            <div className="space-y-1">
              {pointsFaibles.slice(0, 5).map((pf, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--color-gymx-muted)" }}>{labelSousRegion(pf.sous_region)}</span>
                  <span className="font-semibold" style={{ color: pf.sets === 0 ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
                    {pf.sets === 0 ? "Non travaille" : pf.sets + " series"}
                  </span>
                </div>
              ))}
            </div>
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

      {goalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-area-top safe-area-bottom"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="card-title">Objectif — {goalModal.nom}</p>
            <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>
              Actuel : <span className="font-mono font-semibold" style={{ color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>{goalModal.current} kg</span>
            </p>
            <input type="number" inputMode="decimal" placeholder="Poids cible (kg)"
              value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
              className="input-field w-full" style={{ fontSize: "16px" }} />
            {goalInput && parseFloat(goalInput) > goalModal.current && projections.find(p => p.exercice_id === goalModal.exoId) && (
              (() => {
                const p = projections.find(pr => pr.exercice_id === goalModal.exoId)!;
                const target = parseFloat(goalInput);
                const diff = target - p.charge_actuelle;
                const weeks = p.moyenne_hebdo > 0 ? Math.round(diff / p.moyenne_hebdo) : null;
                return (
                  <div className="space-y-1">
                    <p className="text-sm">
                      {weeks !== null
                        ? `~ ${weeks} semaines au rythme actuel`
                        : "Pas assez de données pour estimer"}
                    </p>
                    {weeks !== null && (
                      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min((target / (p.charge_actuelle * 2)) * 100, 100)}%`, backgroundColor: "var(--color-gymx-accent)" }} />
                      </div>
                    )}
                  </div>
                );
              })()
            )}
            <div className="flex gap-2">
              <button onClick={() => setGoalModal(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold touch-target"
                style={{ border: "1px solid var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                Annuler
              </button>
              <button onClick={() => {
                if (!goalInput || !goalModal) return;
                const v = parseFloat(goalInput);
                if (v <= 0) return;
                const newGoals = { ...goals, [goalModal.exoId]: v };
                setGoals(newGoals);
                localStorage.setItem("gymx_goals", JSON.stringify(newGoals));
                setGoalModal(null);
                setGoalInput("");
              }} disabled={!goalInput || parseFloat(goalInput) <= 0}
                className="flex-1 py-3 rounded-xl text-sm font-semibold touch-target disabled:opacity-30"
                style={{ backgroundColor: "var(--color-gymx-accent)", color: "#0a0a0b" }}>
                Fixer l&apos;objectif
              </button>
            </div>
          </div>
        </div>
      )}

      <CalendrierWidget refreshKey={calRefreshKey} />

      <nav className="sticky bottom-0 border-t bg-gymx-surface px-2 py-1 flex justify-around items-center z-50" style={{ borderColor: "var(--color-gymx-border)", paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
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
