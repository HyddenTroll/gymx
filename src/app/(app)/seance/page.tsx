"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculerProgression } from "@/lib/progression/engine";
import { getOrCreateSeanceDuJour } from "@/lib/seance/seance-service";
import { faireRotation } from "@/lib/programme/rotation-service";
import { Check, Timer, Play, Pause, ChevronRight } from "lucide-react";
import type { Cran, Exercice } from "@/types";

interface SerieLog {
  id?: string;
  exercice_id: string;
  reps: number;
  charge: number;
  validee: boolean;
  ordre: number;
}

interface ExerciceEnCours {
  exercice: Exercice;
  structure_id: string;
  series_cibles: number;
  reps_cibles: number;
  charge_cible: number;
  role: string;
  fige: boolean;
  series: SerieLog[];
  slider: Cran | null;
  slider_submitted: boolean;
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

export default function SeancePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [noProfil, setNoProfil] = useState(false);
  const [noProgramme, setNoProgramme] = useState(false);
  const [seanceId, setSeanceId] = useState<string | null>(null);
  const [exercices, setExercices] = useState<ExerciceEnCours[]>([]);
  const [exoActif, setExoActif] = useState(0);
  const [chrono, setChrono] = useState<number | null>(null);
  const [chronoRunning, setChronoRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const chargerSeance = useCallback(async () => {
    const result = await getOrCreateSeanceDuJour();
    if (!result) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setNoProfil(true);
      setLoading(false);
      return;
    }

    setSeanceId(result.seance.id);

    if (result.nouvelle || result.exercices.length === 0) {
      const { data: prog } = await supabase
        .from("programme_actif")
        .select("*")
        .single();

      if (!prog) { setNoProgramme(true); setLoading(false); return; }

      const { data: structures } = await supabase
        .from("programme_structure")
        .select(`id, exercice_id, ordre, series_cibles, reps_cibles, role, fige`)
        .eq("programme_actif_id", prog.id)
        .eq("jour", result.seance.jour_du_programme)
        .order("ordre");

      if (!structures || structures.length === 0) {
        setNoProgramme(true);
        setLoading(false);
        return;
      }

      const exosAvecCharges: ExerciceEnCours[] = [];

      for (const s of structures) {
        const { data: exo } = await supabase
          .from("exercices")
          .select("*")
          .eq("id", s.exercice_id)
          .single();

        let chargeCible = 0;
        if (exo) {
          const { data: charge } = await supabase
            .from("charges")
            .select("charge_actuelle")
            .eq("user_id", prog.user_id)
            .eq("exercice_id", s.exercice_id)
            .maybeSingle();

          chargeCible = charge?.charge_actuelle ?? 0;

          if (!charge) {
            await supabase.from("charges").insert({
              user_id: prog.user_id,
              exercice_id: s.exercice_id,
              charge_actuelle: 0,
              unite: exo.unite_par_defaut,
              pas: exo.pas_par_defaut,
              sens: exo.assist_inverse ? "inverse" : "normal",
              compteur_echecs: 0,
            });
          }
        }

        const series = Array.from({ length: s.series_cibles }, (_, i) => ({
          exercice_id: s.exercice_id,
          reps: s.reps_cibles,
          charge: chargeCible,
          validee: false,
          ordre: i,
        }));

        exosAvecCharges.push({
          exercice: exo || ({} as Exercice),
          structure_id: s.id,
          series_cibles: s.series_cibles,
          reps_cibles: s.reps_cibles,
          charge_cible: chargeCible,
          role: s.role,
          fige: s.fige,
          series,
          slider: null,
          slider_submitted: false,
        });
      }

      setExercices(exosAvecCharges);
    } else {
      const grouped: Map<string, ExerciceEnCours> = new Map();
      for (const serie of result.exercices) {
        const key = serie.exercice_id;
        if (!grouped.has(key)) {
          const { data: exo } = await supabase
            .from("exercices")
            .select("*")
            .eq("id", key)
            .single();

          const { data: prog } = await supabase
            .from("programme_actif")
            .select("*")
            .single();

          grouped.set(key, {
            exercice: exo || ({} as Exercice),
            structure_id: "",
            series_cibles: 0,
            reps_cibles: 0,
            charge_cible: 0,
            role: "accessoire",
            fige: false,
            series: [],
            slider: null,
            slider_submitted: false,
          });
        }
        grouped.get(key)!.series.push({
          id: serie.id,
          exercice_id: serie.exercice_id,
          reps: serie.reps,
          charge: serie.charge,
          validee: serie.validee,
          ordre: serie.ordre,
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
      interval = setInterval(() => {
        setChrono((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
      }, 1000);
    }
    if (chrono === 0) setChronoRunning(false);
    return () => clearInterval(interval);
  }, [chronoRunning, chrono]);

  const updateSerie = (exoIdx: number, serieIdx: number, updates: Partial<SerieLog>) => {
    setExercices((prev) => {
      const next = [...prev];
      next[exoIdx] = {
        ...next[exoIdx],
        series: next[exoIdx].series.map((s, i) =>
          i === serieIdx ? { ...s, ...updates } : s
        ),
      };
      return next;
    });
  };

  const validerSerie = (exoIdx: number, serieIdx: number) => {
    updateSerie(exoIdx, serieIdx, { validee: true });
    setChrono(resteRepos(exercices[exoIdx].role));
    setChronoRunning(true);
  };

  const formaterTemps = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const submitSlider = async (exoIdx: number, cran: Cran) => {
    if (!seanceId) return;

    const exo = exercices[exoIdx];
    setExercices((prev) => {
      const next = [...prev];
      next[exoIdx] = { ...next[exoIdx], slider: cran, slider_submitted: true };
      return next;
    });

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("effort").upsert({
      user_id: user!.id,
      seance_id: seanceId,
      exercice_id: exo.exercice.id,
      valeur: cranLabels.findIndex((c) => c.value === cran) + 1,
      cran,
    });

    const { data: chargeData } = await supabase
      .from("charges")
      .select("*")
      .eq("user_id", user!.id)
      .eq("exercice_id", exo.exercice.id)
      .single();

    if (!chargeData) return;

    const { data: profil } = await supabase
      .from("profil")
      .select("niveau")
      .eq("user_id", user!.id)
      .single();

    const resultat = calculerProgression(
      cran,
      profil?.niveau || "intermediaire",
      {
        unite: chargeData.unite,
        pas: chargeData.pas,
        sens: chargeData.sens,
        compteur_echecs: chargeData.compteur_echecs,
      },
      chargeData.charge_actuelle
    );

    await supabase
      .from("charges")
      .update({
        charge_actuelle: resultat.nouvelle_charge,
        compteur_echecs: resultat.nouveau_compteur_echecs,
      })
      .eq("id", chargeData.id);

    if (exo.role === "accessoire" && !exo.fige) {
      await faireRotation(
        exo.structure_id,
        exo.exercice.id,
        exo.exercice.sous_region,
        exo.fige
      );
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
            seance_id: seanceId,
            exercice_id: serie.exercice_id,
            reps: serie.reps,
            charge: serie.charge,
            unite: exo.exercice.unite_par_defaut || "kg",
            validee: true,
            ordre: serie.ordre,
          });
        }
      }
    }

    await supabase
      .from("seances")
      .update({
        terminee: true,
        duree: 0,
      })
      .eq("id", seanceId);

    setSaving(false);
    router.push("/qg");
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-gymx-bg flex items-center justify-center">
        <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
      </div>
    );
  }

  if (noProfil || noProgramme) {
    return (
      <div className="min-h-dvh bg-gymx-bg p-4 flex flex-col items-center justify-center">
        <div className="hud-panel w-full max-w-sm p-8 text-center space-y-4">
          <h2 className="font-display text-gymx-cyan text-lg">
            {noProfil ? "Configure ton profil" : "Choisis un programme"}
          </h2>
          <button
            onClick={() => router.push("/onboarding")}
            className="bg-gymx-cyan/10 border border-gymx-cyan text-gymx-cyan font-display py-3 px-6 rounded-lg"
          >
            COMMENCER
          </button>
        </div>
      </div>
    );
  }

  const toutValide = exercices.every(
    (exo) => exo.series.every((s) => s.validee) && exo.slider_submitted
  );

  return (
    <div className="min-h-dvh bg-gymx-bg p-4 space-y-4 safe-area-bottom">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-display text-xl text-gymx-cyan">Séance du jour</h1>
          <p className="text-gymx-muted text-xs">
            {exercices.filter((e) => e.series.every((s) => s.validee)).length}/{exercices.length} exos
          </p>
        </div>
        <button
          onClick={sauverSeance}
          disabled={!toutValide || saving}
          className="bg-gymx-violet/10 border border-gymx-violet text-gymx-violet font-display text-sm px-4 py-2 rounded-lg disabled:opacity-30"
        >
          {saving ? "SAUVEGARDE…" : "TERMINER"}
        </button>
      </header>

      {exercices.length === 0 && (
        <div className="hud-panel p-6 text-center space-y-2">
          <p className="text-gymx-muted">Aucun exercice pour aujourd&apos;hui.</p>
        </div>
      )}

      {exercices.map((exo, exoIdx) => (
        <div
          key={exo.exercice.id}
          className={`hud-panel p-4 space-y-3 animate-slide-up ${
            exoIdx === exoActif ? "border-gymx-cyan" : ""
          }`}
          style={{ animationDelay: `${exoIdx * 0.1}s` }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-display text-sm text-gymx-text">
                {exo.exercice.nom_fr || "Exercice"}
              </h3>
              <p className="text-technical">{exo.role === "principal" ? "Principal (fixe)" : "Accessoire"}</p>
            </div>
            <span className="text-xs text-gymx-muted">
              {exo.charge_cible > 0
                ? `${exo.charge_cible} ${exo.exercice.unite_par_defaut || "kg"}`
                : "À estimer"}
            </span>
          </div>

          <div className="space-y-2">
            {exo.series.map((serie, serieIdx) => (
              <div
                key={serieIdx}
                className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                  serie.validee ? "bg-gymx-cyan/5" : "bg-gymx-bg2"
                }`}
              >
                <span className="font-display text-xs text-gymx-muted w-6">
                  S{serieIdx + 1}
                </span>

                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="number"
                    value={serie.reps}
                    onChange={(e) => updateSerie(exoIdx, serieIdx, { reps: Number(e.target.value) || 0 })}
                    disabled={serie.validee}
                    className="w-14 bg-gymx-bg border border-gymx-border rounded px-2 py-1.5 text-center text-sm text-gymx-text disabled:opacity-50"
                    inputMode="numeric"
                  />
                  <span className="text-xs text-gymx-muted">réps</span>

                  {exo.exercice.unite_par_defaut !== "reps" && (
                    <>
                      <input
                        type="number"
                        value={serie.charge}
                        onChange={(e) => updateSerie(exoIdx, serieIdx, { charge: Number(e.target.value) || 0 })}
                        disabled={serie.validee}
                        className="w-16 bg-gymx-bg border border-gymx-border rounded px-2 py-1.5 text-center text-sm text-gymx-text disabled:opacity-50"
                        inputMode="decimal"
                      />
                      <span className="text-xs text-gymx-muted">{exo.exercice.unite_par_defaut || "kg"}</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => validerSerie(exoIdx, serieIdx)}
                  disabled={serie.validee}
                  className={`p-2 rounded-full transition-all ${
                    serie.validee
                      ? "bg-gymx-cyan/20 text-gymx-cyan"
                      : "bg-gymx-border text-gymx-muted hover:bg-gymx-cyan/20"
                  }`}
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {exo.series.every((s) => s.validee) && !exo.slider_submitted && (
            <div className="space-y-2 pt-2 border-t border-gymx-border">
              <p className="text-xs text-gymx-muted">
                C&apos;était comment&nbsp;?
                <span className="text-technical ml-1">(RPE)</span>
              </p>
              <div className="flex gap-1">
                {cranLabels.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => submitSlider(exoIdx, c.value)}
                    className="flex-1 py-2 rounded-lg text-xs font-display border transition-all bg-gymx-bg2 border-gymx-border text-gymx-muted hover:border-gymx-magenta hover:text-gymx-magenta"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {exo.slider_submitted && (
            <p className="text-xs text-gymx-muted text-center pt-1">
              ✓ Effort enregistré
            </p>
          )}
        </div>
      ))}

      {chrono !== null && chrono > 0 && (
        <div className="fixed bottom-20 right-4 hud-panel px-4 py-2 flex items-center gap-3 z-50 hud-glow-cyan">
          <Timer className="w-4 h-4 text-gymx-cyan" />
          <span className="font-display text-gymx-cyan">{formaterTemps(chrono)}</span>
          <button
            onClick={() => setChronoRunning(!chronoRunning)}
            className="p-1 text-gymx-muted hover:text-gymx-cyan"
          >
            {chronoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
