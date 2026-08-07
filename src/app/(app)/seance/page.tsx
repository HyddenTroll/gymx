"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculerProgression } from "@/lib/progression/engine";
import { getOrCreateSeanceDuJour } from "@/lib/seance/seance-service";
import { faireRotation } from "@/lib/programme/rotation-service";
import { Check, Timer, Play, Pause, Dumbbell } from "lucide-react";
import type { Cran, Exercice } from "@/types";
import Link from "next/link";

interface SerieLog {
  id?: string; exercice_id: string; reps: number; charge: number; validee: boolean; ordre: number;
}

interface ExerciceEnCours {
  exercice: Exercice; structure_id: string; series_cibles: number; reps_cibles: number;
  charge_cible: number; role: string; fige: boolean;
  series: SerieLog[]; slider: Cran | null; slider_submitted: boolean;
}

const cranLabels: { value: Cran; label: string; rpe: string }[] = [
  { value: "facile", label: "Facile", rpe: "~4" },
  { value: "ca_passe", label: "Ça passe", rpe: "~6-7" },
  { value: "dur", label: "Dur", rpe: "8" },
  { value: "a_la_limite", label: "À la limite", rpe: "9" },
  { value: "impossible", label: "Impossible", rpe: "10" },
];

const cranColors = [
  "border-green-500/40 bg-green-500/10 text-green-400",
  "border-lime-500/40 bg-lime-500/10 text-lime-400",
  "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  "border-orange-500/40 bg-orange-500/10 text-orange-400",
  "border-red-500/40 bg-red-500/10 text-red-400",
];

const resteRepos = (role: string, objectif?: string): number => {
  if (objectif === "force") return role === "principal" ? 210 : 120;
  return role === "principal" ? 150 : 75;
};

const navItems = [
  { href: "/qg", label: "QG", icon: Timer },
  { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Check },
  { href: "/progression", label: "Progression", icon: Play },
];

export default function SeancePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [noProfil, setNoProfil] = useState(false);
  const [noProgramme, setNoProgramme] = useState(false);
  const [seanceId, setSeanceId] = useState<string | null>(null);
  const [exercices, setExercices] = useState<ExerciceEnCours[]>([]);
  const [chrono, setChrono] = useState<number | null>(null);
  const [chronoRunning, setChronoRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const chargerSeance = useCallback(async () => {
    const result = await getOrCreateSeanceDuJour();
    if (!result) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setNoProfil(true); setLoading(false); return;
    }
    setSeanceId(result.seance.id);

    if (result.nouvelle || result.exercices.length === 0) {
      const { data: prog } = await supabase.from("programme_actif").select("*").single();
      if (!prog) { setNoProgramme(true); setLoading(false); return; }

      const { data: structures } = await supabase
        .from("programme_structure").select("id, exercice_id, ordre, series_cibles, reps_cibles, role, fige")
        .eq("programme_actif_id", prog.id).eq("jour", result.seance.jour_du_programme).order("ordre");

      if (!structures || structures.length === 0) { setNoProgramme(true); setLoading(false); return; }

      const exosAvecCharges: ExerciceEnCours[] = [];
      for (const s of structures) {
        const { data: exo } = await supabase.from("exercices").select("*").eq("id", s.exercice_id).single();
        let chargeCible = 0;
        if (exo) {
          const { data: charge } = await supabase.from("charges")
            .select("charge_actuelle").eq("user_id", prog.user_id).eq("exercice_id", s.exercice_id).maybeSingle();
          chargeCible = charge?.charge_actuelle ?? 0;
          if (!charge) {
            await supabase.from("charges").insert({
              user_id: prog.user_id, exercice_id: s.exercice_id, charge_actuelle: 0,
              unite: exo.unite_par_defaut, pas: exo.pas_par_defaut,
              sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0,
            });
          }
        }
        const series = Array.from({ length: s.series_cibles }, (_, i) => ({
          exercice_id: s.exercice_id, reps: s.reps_cibles, charge: chargeCible, validee: false, ordre: i,
        }));
        exosAvecCharges.push({
          exercice: exo || ({} as Exercice), structure_id: s.id, series_cibles: s.series_cibles,
          reps_cibles: s.reps_cibles, charge_cible: chargeCible, role: s.role, fige: s.fige, series, slider: null, slider_submitted: false,
        });
      }
      setExercices(exosAvecCharges);
    } else {
      const grouped: Map<string, ExerciceEnCours> = new Map();
      for (const serie of result.exercices) {
        const key = serie.exercice_id;
        if (!grouped.has(key)) {
          const { data: exo } = await supabase.from("exercices").select("*").eq("id", key).single();
          const { data: prog } = await supabase.from("programme_actif").select("*").single();
          grouped.set(key, {
            exercice: exo || ({} as Exercice), structure_id: "", series_cibles: 0, reps_cibles: 0,
            charge_cible: 0, role: "accessoire", fige: false, series: [], slider: null, slider_submitted: false,
          });
        }
        grouped.get(key)!.series.push({
          id: serie.id, exercice_id: serie.exercice_id, reps: serie.reps,
          charge: serie.charge, validee: serie.validee, ordre: serie.ordre,
        });
      }
      setExercices(Array.from(grouped.values()));
    }
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { chargerSeance(); }, [chargerSeance]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (chronoRunning && chrono !== null && chrono > 0) {
      interval = setInterval(() => { setChrono((prev) => (prev !== null ? Math.max(0, prev - 1) : null)); }, 1000);
    }
    if (chrono === 0) setChronoRunning(false);
    return () => clearInterval(interval);
  }, [chronoRunning, chrono]);

  const updateSerie = (exoIdx: number, serieIdx: number, updates: Partial<SerieLog>) => {
    setExercices((prev) => {
      const next = [...prev];
      next[exoIdx] = { ...next[exoIdx], series: next[exoIdx].series.map((s, i) => i === serieIdx ? { ...s, ...updates } : s) };
      return next;
    });
  };

  const validerSerie = (exoIdx: number, serieIdx: number) => {
    updateSerie(exoIdx, serieIdx, { validee: true });
    setChrono(resteRepos(exercices[exoIdx].role));
    setChronoRunning(true);
  };

  const formaterTemps = (s: number): string => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const submitSlider = async (exoIdx: number, cran: Cran) => {
    if (!seanceId) return;
    const exo = exercices[exoIdx];
    setExercices((prev) => { const n = [...prev]; n[exoIdx] = { ...n[exoIdx], slider: cran, slider_submitted: true }; return n; });

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("effort").upsert({
      user_id: user!.id, seance_id: seanceId, exercice_id: exo.exercice.id,
      valeur: cranLabels.findIndex((c) => c.value === cran) + 1, cran,
    });

    const { data: chargeData } = await supabase.from("charges")
      .select("*").eq("user_id", user!.id).eq("exercice_id", exo.exercice.id).single();

    if (!chargeData) return;

    const { data: profil } = await supabase.from("profil")
      .select("niveau").eq("user_id", user!.id).single();

    const resultat = calculerProgression(cran, profil?.niveau || "intermediaire", {
      unite: chargeData.unite, pas: chargeData.pas, sens: chargeData.sens, compteur_echecs: chargeData.compteur_echecs,
    }, chargeData.charge_actuelle);

    await supabase.from("charges").update({
      charge_actuelle: resultat.nouvelle_charge, compteur_echecs: resultat.nouveau_compteur_echecs,
    }).eq("id", chargeData.id);

    if (exo.role === "accessoire" && !exo.fige) {
      await faireRotation(exo.structure_id, exo.exercice.id, exo.exercice.sous_region, exo.fige);
    }
  };

  const sauverSeance = async () => {
    if (!seanceId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const exo of exercices) {
      for (const serie of exo.series) {
        if (serie.validee) {
          await supabase.from("series").upsert({
            seance_id: seanceId, exercice_id: serie.exercice_id, reps: serie.reps,
            charge: serie.charge, unite: exo.exercice.unite_par_defaut || "kg", validee: true, ordre: serie.ordre,
          });
        }
      }
    }
    await supabase.from("seances").update({ terminee: true, duree: 0 }).eq("id", seanceId);
    setSaving(false);
    router.push("/qg");
  };

  if (loading) return (
    <div className="min-h-dvh bg-gymx-bg flex items-center justify-center" style={{ minHeight: "100dvh" }}>
      <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
    </div>
  );

  if (noProfil || noProgramme) return (
    <div className="min-h-dvh bg-gymx-bg p-4 flex flex-col items-center justify-center" style={{ minHeight: "100dvh" }}>
      <div className="hud-panel w-full max-w-sm p-6 text-center space-y-3">
        <h2 className="font-display text-gymx-cyan text-base">{noProfil ? "Configure ton profil" : "Choisis un programme"}</h2>
        <button onClick={() => router.push("/onboarding")}
          className="bg-gymx-cyan/10 border border-gymx-cyan text-gymx-cyan font-display py-3.5 px-6 rounded-lg active:bg-gymx-cyan/20 touch-target">
          COMMENCER
        </button>
      </div>
    </div>
  );

  const toutValide = exercices.every((exo) => exo.series.every((s) => s.validee) && exo.slider_submitted);

  return (
    <div className="min-h-dvh bg-gymx-bg flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 safe-area-top">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg text-gymx-cyan">Séance du jour</h1>
            <p className="text-gymx-muted text-xs">{exercices.filter((e) => e.series.every((s) => s.validee)).length}/{exercices.length} exos</p>
          </div>
          <button onClick={sauverSeance} disabled={!toutValide || saving}
            className="bg-gymx-violet/10 border border-gymx-violet text-gymx-violet font-display text-sm px-4 py-2.5 rounded-lg active:bg-gymx-violet/20 transition-colors disabled:opacity-30 touch-target">
            {saving ? "SAUVEGARDE…" : "TERMINER"}
          </button>
        </header>

        {exercices.length === 0 && (
          <div className="hud-panel p-6 text-center">
            <p className="text-gymx-muted text-sm leading-relaxed">Aucun exercice pour aujourd&apos;hui.</p>
          </div>
        )}

        {exercices.map((exo, exoIdx) => (
          <div key={exo.exercice.id} className="hud-panel p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="font-display text-sm text-gymx-text truncate">{exo.exercice.nom_fr || "Exercice"}</h3>
                <p className="text-technical">{exo.role === "principal" ? "Principal (fixe)" : "Accessoire"}</p>
              </div>
              <span className="text-xs text-gymx-muted shrink-0">
                {exo.charge_cible > 0 ? `${exo.charge_cible} ${exo.exercice.unite_par_defaut || "kg"}` : "À estimer"}
              </span>
            </div>

            <div className="space-y-1.5">
              {exo.series.map((serie, serieIdx) => (
                <div key={serieIdx} className={`flex items-center gap-1.5 p-2 rounded-lg ${serie.validee ? "bg-gymx-cyan/5" : "bg-gymx-bg2"}`}>
                  <span className="font-display text-[10px] text-gymx-muted w-5 shrink-0">S{serieIdx + 1}</span>
                  <div className="flex-1 flex items-center gap-1.5">
                    <input type="number" value={serie.reps} onChange={(e) => updateSerie(exoIdx, serieIdx, { reps: Number(e.target.value) || 0 })}
                      disabled={serie.validee}
                      className="w-14 bg-gymx-bg border border-gymx-border rounded px-2 py-1.5 text-center text-sm text-gymx-text disabled:opacity-50 touch-target"
                      style={{ fontSize: "16px" }} inputMode="numeric" />
                    <span className="text-[10px] text-gymx-muted">réps</span>
                    {exo.exercice.unite_par_defaut !== "reps" && (
                      <>
                        <input type="number" value={serie.charge} onChange={(e) => updateSerie(exoIdx, serieIdx, { charge: Number(e.target.value) || 0 })}
                          disabled={serie.validee}
                          className="w-16 bg-gymx-bg border border-gymx-border rounded px-2 py-1.5 text-center text-sm text-gymx-text disabled:opacity-50 touch-target"
                          style={{ fontSize: "16px" }} inputMode="decimal" />
                        <span className="text-[10px] text-gymx-muted">{exo.exercice.unite_par_defaut || "kg"}</span>
                      </>
                    )}
                  </div>
                  <button onClick={() => validerSerie(exoIdx, serieIdx)} disabled={serie.validee}
                    className={`p-2 rounded-full transition-colors touch-target ${serie.validee ? "bg-gymx-cyan/20 text-gymx-cyan" : "bg-gymx-border text-gymx-muted active:bg-gymx-cyan/20"}`}>
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {exo.series.every((s) => s.validee) && !exo.slider_submitted && (
              <div className="space-y-1.5 pt-2 border-t border-gymx-border">
                <p className="text-xs text-gymx-muted">C&apos;était comment ? <span className="text-technical">(RPE)</span></p>
                <div className="grid grid-cols-5 gap-1">
                  {cranLabels.map((c, ci) => (
                    <button key={c.value} onClick={() => submitSlider(exoIdx, c.value)}
                      className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg border transition-colors active:scale-95 ${cranColors[ci]} touch-target`}>
                      <span className="text-[9px] font-display leading-tight text-center">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {exo.slider_submitted && (
              <p className="text-[10px] text-gymx-muted text-center">✓ Effort enregistré</p>
            )}
          </div>
        ))}

        {chrono !== null && chrono > 0 && (
          <div className="fixed bottom-20 right-3 hud-panel px-3 py-2 flex items-center gap-2 z-50 hud-glow-cyan touch-target">
            <Timer className="w-4 h-4 text-gymx-cyan shrink-0" />
            <span className="font-display text-gymx-cyan">{formaterTemps(chrono)}</span>
            <button onClick={() => setChronoRunning(!chronoRunning)} className="p-1 text-gymx-muted active:text-gymx-cyan touch-target">
              {chronoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        )}
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
