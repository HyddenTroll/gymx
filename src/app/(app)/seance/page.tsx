"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculerProgression } from "@/lib/progression/engine";
import { getOrCreateSeanceDuJour } from "@/lib/seance/seance-service";
import { faireRotation } from "@/lib/programme/rotation-service";
import { Check, Timer, Play, Pause, BarChart3, Dumbbell, Library, TrendingUp } from "lucide-react";
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

const resteRepos = (role: string, objectif?: string): number => {
  if (objectif === "force") return role === "principal" ? 210 : 120;
  return role === "principal" ? 150 : 75;
};

const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 },
  { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/progression", label: "Progression", icon: TrendingUp },
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
  const pathname = "/seance";

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
      const { data: structures } = await supabase.from("programme_structure").select("id, exercice_id, ordre, series_cibles, reps_cibles, role, fige")
        .eq("programme_actif_id", prog.id).eq("jour", result.seance.jour_du_programme).order("ordre");
      if (!structures || structures.length === 0) { setNoProgramme(true); setLoading(false); return; }

      const exosAvecCharges: ExerciceEnCours[] = [];
      for (const s of structures) {
        const { data: exo } = await supabase.from("exercices").select("*").eq("id", s.exercice_id).single();
        let chargeCible = 0;
        if (exo) {
          const { data: charge } = await supabase.from("charges").select("charge_actuelle").eq("user_id", prog.user_id).eq("exercice_id", s.exercice_id).maybeSingle();
          chargeCible = charge?.charge_actuelle ?? 0;
          if (!charge) {
            await supabase.from("charges").insert({
              user_id: prog.user_id, exercice_id: s.exercice_id, charge_actuelle: 0,
              unite: exo.unite_par_defaut, pas: exo.pas_par_defaut, sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0,
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
        grouped.get(key)!.series.push({ id: serie.id, exercice_id: serie.exercice_id, reps: serie.reps, charge: serie.charge, validee: serie.validee, ordre: serie.ordre });
      }
      setExercices(Array.from(grouped.values()));
    }
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { chargerSeance(); }, [chargerSeance]);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (chronoRunning && chrono !== null && chrono > 0) {
      interval = setInterval(() => { setChrono((p) => (p !== null ? Math.max(0, p - 1) : null)); }, 1000);
    }
    if (chrono === 0) setChronoRunning(false);
    return () => clearInterval(interval);
  }, [chronoRunning, chrono]);

  const updateSerie = (exoIdx: number, serieIdx: number, updates: Partial<SerieLog>) => {
    setExercices((prev) => {
      const n = [...prev]; n[exoIdx] = { ...n[exoIdx], series: n[exoIdx].series.map((s, i) => i === serieIdx ? { ...s, ...updates } : s) }; return n;
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
    const { data: chargeData } = await supabase.from("charges").select("*").eq("user_id", user!.id).eq("exercice_id", exo.exercice.id).single();
    if (!chargeData) return;
    const { data: profil } = await supabase.from("profil").select("niveau").eq("user_id", user!.id).single();
    const resultat = calculerProgression(cran, profil?.niveau || "intermediaire", {
      unite: chargeData.unite, pas: chargeData.pas, sens: chargeData.sens, compteur_echecs: chargeData.compteur_echecs,
    }, chargeData.charge_actuelle);
    await supabase.from("charges").update({ charge_actuelle: resultat.nouvelle_charge, compteur_echecs: resultat.nouveau_compteur_echecs }).eq("id", chargeData.id);
    if (exo.role === "accessoire" && !exo.fige) {
      await faireRotation(exo.structure_id, exo.exercice.id, exo.exercice.sous_region, exo.fige);
    }
  };

  const sauverSeance = async () => {
    if (!seanceId) return; setSaving(true);
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
    setSaving(false); router.push("/qg");
  };

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement…</p>
    </div>
  );

  if (noProfil || noProgramme) return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <div className="card w-full max-w-sm p-6 text-center space-y-3">
        <p className="card-title">{noProfil ? "Configure ton profil" : "Choisis un programme"}</p>
        <button onClick={() => router.push("/onboarding")}
          className="w-full font-semibold text-sm py-3.5 rounded-lg touch-target"
          style={{ backgroundColor: "var(--color-gymx-text)", color: "var(--color-gymx-surface)" }}>
          Commencer
        </button>
      </div>
    </div>
  );

  const toutValide = exercices.every((e) => e.series.every((s) => s.validee) && e.slider_submitted);

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="card-title">Séance du jour</h1>
            <p className="label text-[10px]" style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-gymx-muted)" }}>
              {exercices.filter((e) => e.series.every((s) => s.validee)).length}/{exercices.length} exercices
            </p>
          </div>
          <button onClick={sauverSeance} disabled={!toutValide || saving}
            className="font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-30 touch-target"
            style={{ backgroundColor: toutValide && !saving ? "var(--color-gymx-text)" : "var(--color-gymx-fill)", color: toutValide && !saving ? "var(--color-gymx-surface)" : "var(--color-gymx-muted)" }}>
            {saving ? "Sauvegarde…" : "Terminer"}
          </button>
        </header>

        {exercices.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Aucun exercice pour aujourd&apos;hui.</p>
          </div>
        )}

        {exercices.map((exo, exoIdx) => (
          <div key={exo.exercice.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="font-semibold text-[15px] text-gymx-text" style={{ fontFamily: "var(--font-body)" }}>{exo.exercice.nom_fr || "Exercice"}</h3>
                <p className="label text-[10px]">{exo.role === "principal" ? "Principal" : "Accessoire"}</p>
              </div>
              <span className="text-sm font-mono font-medium shrink-0" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>
                {exo.charge_cible > 0 ? `${exo.charge_cible} ${exo.exercice.unite_par_defaut || "kg"}` : "—"}
              </span>
            </div>

            <div className="space-y-1.5">
              {exo.series.map((serie, serieIdx) => (
                <div key={serieIdx} className={`flex items-center gap-1.5 p-2 rounded-lg ${serie.validee ? "bg-gymx-accent/5" : ""}`}
                  style={{ backgroundColor: serie.validee ? "rgba(228,0,43,0.04)" : "var(--color-gymx-bg)" }}>
                  <span className="text-xs font-mono w-5 shrink-0" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>S{serieIdx + 1}</span>
                  <div className="flex-1 flex items-center gap-1.5">
                    <input type="number" value={serie.reps} onChange={(e) => updateSerie(exoIdx, serieIdx, { reps: Number(e.target.value) || 0 })}
                      disabled={serie.validee} inputMode="numeric"
                      className="w-14 border rounded px-2 py-1.5 text-center text-sm disabled:opacity-50 touch-target"
                      style={{ fontSize: "16px", borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-surface)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                    <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>réps</span>
                    {exo.exercice.unite_par_defaut !== "reps" && (
                      <>
                        <input type="number" value={serie.charge} onChange={(e) => updateSerie(exoIdx, serieIdx, { charge: Number(e.target.value) || 0 })}
                          disabled={serie.validee} inputMode="decimal"
                          className="w-16 border rounded px-2 py-1.5 text-center text-sm disabled:opacity-50 touch-target"
                          style={{ fontSize: "16px", borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-surface)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                        <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{exo.exercice.unite_par_defaut || "kg"}</span>
                      </>
                    )}
                  </div>
                  <button onClick={() => validerSerie(exoIdx, serieIdx)} disabled={serie.validee}
                    className="p-2 rounded-full transition-colors touch-target"
                    style={{ backgroundColor: serie.validee ? "var(--color-gymx-accent)" : "var(--color-gymx-border)", color: serie.validee ? "var(--color-gymx-surface)" : "var(--color-gymx-muted)" }}>
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {exo.series.every((s) => s.validee) && !exo.slider_submitted && (
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--color-gymx-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-text)" }}>
                  C&apos;était comment&nbsp;? <span className="font-normal" style={{ color: "var(--color-gymx-muted)" }}>(RPE)</span>
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {cranLabels.map((c) => (
                    <button key={c.value} onClick={() => submitSlider(exoIdx, c.value)}
                      className="flex flex-col items-center gap-0.5 py-3 rounded-lg border transition-colors active:scale-95 touch-target "
                      style={{ borderColor: "var(--color-gymx-border)" }}>
                      <span className="text-[11px] font-semibold leading-tight text-center" style={{ fontFamily: "var(--font-body)", color: "var(--color-gymx-text)" }}>{c.label}</span>
                      <span className="text-[9px]" style={{ color: "var(--color-gymx-muted)" }}>{c.rpe}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {exo.slider_submitted && (
              <p className="text-xs text-center" style={{ color: "var(--color-gymx-accent)" }}>✓ Effort enregistré</p>
            )}
          </div>
        ))}

        {chrono !== null && chrono > 0 && (
          <div className="fixed bottom-20 right-3 card px-3 py-2 flex items-center gap-2 z-50"
            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
            <Timer className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-text)" }} />
            <span className="font-mono font-medium" style={{ color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>{formaterTemps(chrono)}</span>
            <button onClick={() => setChronoRunning(!chronoRunning)} className="p-1 touch-target" style={{ color: "var(--color-gymx-muted)" }}>
              {chronoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        )}
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
