"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculerProgressionRPE } from "@/lib/progression/engine";
import { calculerEchauffement, getCoeffExercice } from "@/lib/dashboard/dashboard-service";
import { initialiserGamification, ajouterXP, verifierRecords } from "@/lib/gamification/gamification-service";
import { getOrCreateSeanceDuJour } from "@/lib/seance/seance-service";
import { faireRotation } from "@/lib/programme/rotation-service";
import { incrementerSemaine } from "@/lib/programme/cycles";
import { Check, Timer, Play, Pause, BarChart3, Dumbbell, Library, TrendingUp, User } from "lucide-react";
import type { Cran, Exercice } from "@/types";
import Link from "next/link";

interface SerieLog { id?: string; exercice_id: string; reps: number; charge: number; validee: boolean; ordre: number; }
interface ExerciceEnCours {
  exercice: Exercice; structure_id: string; series_cibles: number; reps_cibles: number;
  charge_cible: number; role: string; fige: boolean;
  series: SerieLog[]; slider: Cran | null; slider_submitted: boolean; unite_actuelle: string;
}

const unitesDisponibles = ["kg", "reps", "unité"];

const rpeLabels = [
  { rpe: 1, label: "Très facile" }, { rpe: 2, label: "Facile" }, { rpe: 3, label: "Assez facile" },
  { rpe: 4, label: "Ça passe" }, { rpe: 5, label: "Confortable" }, { rpe: 6, label: "Un peu dur" },
  { rpe: 7, label: "Dur" }, { rpe: 8, label: "Très dur" }, { rpe: 9, label: "À la limite" }, { rpe: 10, label: "Impossible" },
];

function rpeToCran(rpe: number): Cran {
  if (rpe <= 3) return "facile"; if (rpe <= 6) return "ca_passe"; if (rpe <= 8) return "dur"; if (rpe === 9) return "a_la_limite"; return "impossible";
}

const rpeColors = ["bg-green-500","bg-green-500","bg-lime-500","bg-lime-400","bg-yellow-400","bg-yellow-500","bg-orange-400","bg-orange-500","bg-red-500","bg-red-600"];

const resteRepos = (role: string, rpe?: number, objectif?: string): number => {
  let base = role === "principal" ? 150 : 75;
  if (objectif === "force") base += 30;
  if (rpe !== undefined) {
    if (rpe >= 9) base += 30;
    else if (rpe <= 4) base = Math.max(45, base - 30);
  }
  return base;
};

const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 }, { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library }, { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/profil", label: "Profil", icon: User },
];

export default function SeancePage() {
  const router = useRouter(); const supabase = createClient();
  const [loading, setLoading] = useState(true); const [noProfil, setNoProfil] = useState(false); const [noProgramme, setNoProgramme] = useState(false);
  const [seanceId, setSeanceId] = useState<string | null>(null);
  const [exercices, setExercices] = useState<ExerciceEnCours[]>([]);
  const [chrono, setChrono] = useState<number | null>(null); const [chronoRunning, setChronoRunning] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const pathname = "/seance";

  const chargerSeance = useCallback(async () => {
    const result = await getOrCreateSeanceDuJour();
    if (!result) { const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.push("/login"); return; } setNoProfil(true); setLoading(false); return; }
    setSeanceId(result.seance.id);
    if (result.nouvelle || result.exercices.length === 0) {
      const { data: prog } = await supabase.from("programme_actif").select("*").single();
      if (!prog) { setNoProgramme(true); setLoading(false); return; }
      const { data: structures } = await supabase.from("programme_structure").select("id, exercice_id, ordre, series_cibles, reps_cibles, role, fige")
        .eq("programme_actif_id", prog.id).eq("jour", result.seance.jour_du_programme).order("ordre");
      if (!structures || structures.length === 0) { setNoProgramme(true); setLoading(false); return; }
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let exclusSet = new Set<string>();
      if (currentUser) {
        const { data: exclus } = await supabase.from("exercices_exclus").select("exercice_id").eq("user_id", currentUser.id);
        exclusSet = new Set((exclus || []).map((e: any) => e.exercice_id));
      }
      const exosAvecCharges: ExerciceEnCours[] = [];
      for (const s of structures) {
        let { data: exo } = await supabase.from("exercices").select("*").eq("id", s.exercice_id).single();
        if (exo && exclusSet.has(exo.id)) {
          const newId = await faireRotation(s.id, exo.id, exo.sous_region, s.fige, true);
          if (newId) {
            const { data: newExo } = await supabase.from("exercices").select("*").eq("id", newId).single();
            if (newExo) exo = newExo;
          }
        }
        let chargeCible = 0;
        if (exo) {
          const { data: charge } = await supabase.from("charges").select("charge_actuelle").eq("user_id", prog.user_id).eq("exercice_id", exo.id).maybeSingle();
          chargeCible = charge?.charge_actuelle ?? 0;
          if (!charge) { await supabase.from("charges").insert({ user_id: prog.user_id, exercice_id: exo.id, charge_actuelle: 0, unite: exo.unite_par_defaut, pas: exo.pas_par_defaut, sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0 }); }
        }
        const series = Array.from({ length: s.series_cibles }, (_, i) => ({ exercice_id: exo?.id || s.exercice_id, reps: s.reps_cibles, charge: chargeCible, validee: false, ordre: i }));
        exosAvecCharges.push({ exercice: exo || ({} as Exercice), structure_id: s.id, series_cibles: s.series_cibles, reps_cibles: s.reps_cibles, charge_cible: chargeCible, role: s.role, fige: s.fige, series, slider: null, slider_submitted: false, unite_actuelle: exo?.unite_par_defaut || "kg" });
      }
      setExercices(exosAvecCharges);
    } else {
      const grouped: Map<string, ExerciceEnCours> = new Map();
      for (const serie of result.exercices) {
        const key = serie.exercice_id;
        if (!grouped.has(key)) {
          const { data: exo } = await supabase.from("exercices").select("*").eq("id", key).single();
          grouped.set(key, { exercice: exo || ({} as Exercice), structure_id: "", series_cibles: 0, reps_cibles: 0, charge_cible: 0, role: "accessoire", fige: false, series: [], slider: null, slider_submitted: false, unite_actuelle: "kg" });
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
    if (chronoRunning && chrono !== null && chrono > 0) { interval = setInterval(() => { setChrono((p) => (p !== null ? Math.max(0, p - 1) : null)); }, 1000); }
    if (chrono === 0) setChronoRunning(false);
    return () => clearInterval(interval);
  }, [chronoRunning, chrono]);

  const updateSerie = (exoIdx: number, serieIdx: number, updates: Partial<SerieLog>) => {
    setExercices((prev) => { const n = [...prev]; n[exoIdx] = { ...n[exoIdx], series: n[exoIdx].series.map((s, i) => i === serieIdx ? { ...s, ...updates } : s) }; return n; });
  };

  const sauverSerie = async (exoIdx: number, serieIdx: number) => {
    if (!seanceId) return;
    const exo = exercices[exoIdx];
    const serie = exo.series[serieIdx];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("series").upsert({
      seance_id: seanceId,
      exercice_id: serie.exercice_id,
      reps: serie.reps,
      charge: serie.charge,
      unite: exo.unite_actuelle,
      validee: serie.validee,
      ordre: serie.ordre,
    });
  };

  const toggleSerie = async (exoIdx: number, serieIdx: number) => {
    const serie = exercices[exoIdx].series[serieIdx];
    const nouvelleValeur = !serie.validee;
    setExercices((prev) => {
      const n = [...prev];
      n[exoIdx] = { ...n[exoIdx], series: n[exoIdx].series.map((s, i) => i === serieIdx ? { ...s, validee: nouvelleValeur } : s) };
      return n;
    });
    if (nouvelleValeur) { setChrono(resteRepos(exercices[exoIdx].role)); setChronoRunning(true); }
    await sauverSerie(exoIdx, serieIdx);
  };

  const formaterTemps = (s: number): string => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSwap = async (exoIdx: number) => {
    const exo = exercices[exoIdx];
    if (!seanceId || !exo.structure_id) return;
    const nextId = await faireRotation(exo.structure_id, exo.exercice.id, exo.exercice.sous_region, exo.fige, true);
    if (!nextId) return;
    const { data: nextExo } = await supabase.from("exercices").select("*").eq("id", nextId).single();
    if (!nextExo) return;
    const { data: { user } } = await supabase.auth.getUser();
    let chargeCible = 0;
    if (user) {
      const { data: charge } = await supabase.from("charges").select("charge_actuelle").eq("user_id", user.id).eq("exercice_id", nextId).maybeSingle();
      chargeCible = charge?.charge_actuelle ?? 0;
      if (!charge) {
        await supabase.from("charges").insert({ user_id: user.id, exercice_id: nextId, charge_actuelle: 0, unite: nextExo.unite_par_defaut, pas: nextExo.pas_par_defaut, sens: nextExo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0 });
      }
    }
    setExercices((prev) => {
      const n = [...prev];
      n[exoIdx] = {
        ...n[exoIdx],
        exercice: nextExo,
        charge_cible: chargeCible,
        series: Array.from({ length: n[exoIdx].series_cibles }, (_, i) => ({ exercice_id: nextId, reps: n[exoIdx].reps_cibles, charge: chargeCible, validee: false, ordre: i })),
        slider: null, slider_submitted: false, unite_actuelle: nextExo.unite_par_defaut || "kg",
      };
      return n;
    });
    setMessage(`↻ ${nextExo.nom_fr}`);
    setTimeout(() => setMessage(""), 2000);
  };

  const submitSlider = async (exoIdx: number, cran: Cran, rpeValue?: number) => {
    if (!seanceId) return;
    const exo = exercices[exoIdx];
    const rpe = rpeValue || (cran === "facile" ? 4 : cran === "ca_passe" ? 6 : cran === "dur" ? 8 : cran === "a_la_limite" ? 9 : 10);
    setExercices((prev) => { const n = [...prev]; n[exoIdx] = { ...n[exoIdx], slider: cran, slider_submitted: true }; return n; });
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("effort").upsert({ user_id: user!.id, seance_id: seanceId, exercice_id: exo.exercice.id, valeur: rpe, cran });
    const { data: chargeData } = await supabase.from("charges").select("*").eq("user_id", user!.id).eq("exercice_id", exo.exercice.id).single();
    if (!chargeData) return;
    const { data: profil } = await supabase.from("profil").select("niveau").eq("user_id", user!.id).single();

    const { data: historique } = await supabase.from("effort").select("valeur").eq("user_id", user!.id).eq("exercice_id", exo.exercice.id).order("created_at", { ascending: false }).limit(5);
    const historiqueRPE = (historique || []).map((e: any) => e.valeur).reverse();

    const resultat = calculerProgressionRPE(rpe, profil?.niveau || "intermediaire", { unite: chargeData.unite, pas: chargeData.pas, sens: chargeData.sens, compteur_echecs: chargeData.compteur_echecs }, chargeData.charge_actuelle, historiqueRPE);
    await supabase.from("charges").update({ charge_actuelle: resultat.nouvelle_charge, compteur_echecs: resultat.nouveau_compteur_echecs }).eq("id", chargeData.id);
    if (exo.role === "accessoire" && !exo.fige) { await faireRotation(exo.structure_id, exo.exercice.id, exo.exercice.sous_region, exo.fige); }
    if (resultat.plateau_detecte || resultat.deload_suggere) {
      setMessage(`⚠ ${resultat.deload_suggere ? "Semaine allégée recommandée" : "Plateau détecté"}`);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  const sauverSeance = async () => {
    if (!seanceId) return; setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let xpGagne = 0; let nouveauRecord = false;

    for (const exo of exercices) {
      for (const serie of exo.series) {
        if (serie.validee) {
          await supabase.from("series").upsert({ seance_id: seanceId, exercice_id: serie.exercice_id, reps: serie.reps, charge: serie.charge, unite: exo.unite_actuelle, validee: true, ordre: serie.ordre });
          const estRecord = await verifierRecords(user.id, serie.exercice_id, serie.charge, serie.reps);
          if (estRecord) { nouveauRecord = true; xpGagne += 100; }
        }
      }
    }
    await supabase.from("seances").update({ terminee: true, duree: 0 }).eq("id", seanceId);
    xpGagne += 50;

    await initialiserGamification(user.id);
    if (xpGagne > 0) await ajouterXP(user.id, xpGagne, "séance terminée");

    await incrementerSemaine(user.id);

    const { data: g } = await supabase.from("gamification").select("*").eq("user_id", user.id).single();
    if (g) {
      const newStreak = g.streak + 1;
      await supabase.from("gamification").update({ streak: newStreak }).eq("id", g.id);
    }

    setSaving(false);
    if (nouveauRecord) setMessage(`🏆 Record battu ! +${xpGagne} XP`);
    else setMessage(`+${xpGagne} XP gagné`);
    setTimeout(() => router.push("/qg"), 1200);
  };

  if (loading) return (<div className="min-h-dvh flex items-center justify-center" style={{ minHeight: "100dvh" }}><p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement…</p></div>);
  if (noProfil || noProgramme) return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ minHeight: "100dvh" }}>
      <div className="card w-full max-w-sm p-6 text-center space-y-3">
        <p className="card-title">{noProfil ? "Configure ton profil" : "Choisis un programme"}</p>
        <button onClick={() => router.push("/onboarding")} className="btn-primary w-full">Commencer</button>
      </div>
    </div>
  );

  const toutValide = exercices.every((e) => e.series.every((s) => s.validee) && e.slider_submitted);

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="card-title">Séance du jour</h1>
            <p className="label text-[10px]">{exercices.filter((e) => e.series.every((s) => s.validee)).length}/{exercices.length} exercices</p>
          </div>
          <button onClick={sauverSeance} disabled={!toutValide || saving} className="touch-target"
            style={{ backgroundColor: toutValide && !saving ? "var(--color-gymx-accent)" : "var(--color-gymx-fill)", color: toutValide && !saving ? "#0a0a0b" : "var(--color-gymx-muted)", fontWeight: 600, fontSize: "14px", padding: "10px 16px", borderRadius: "12px", border: "none" }}>
            {saving ? "Sauvegarde…" : "Terminer"}
          </button>
        </header>

        {message && (
          <div className="card p-3 text-sm font-semibold text-center animate-fade-in" style={{ color: "var(--color-gymx-accent)" }}>
            {message}
          </div>
        )}

        {exercices.length === 0 && (<div className="card p-6 text-center"><p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Aucun exercice pour aujourd&apos;hui.</p></div>)}

        {exercices.map((exo, exoIdx) => (
          <div key={exo.exercice.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="font-semibold text-[15px] text-gymx-text" style={{ fontFamily: "var(--font-body)" }}>{exo.exercice.nom_fr || "Exercice"}</h3>
                <p className="label text-[10px]">{exo.role === "principal" ? "Principal" : "Accessoire"}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {exo.structure_id && !exo.series.every((s) => s.validee) && (
                  <button onClick={() => handleSwap(exoIdx)} className="text-[10px] font-semibold px-1.5 py-1 rounded-lg transition-colors touch-target"
                    style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                    ↻
                  </button>
                )}
                <span className="text-sm font-mono font-medium" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>
                  {exo.charge_cible > 0 ? `${exo.charge_cible} ${exo.unite_actuelle}` : "—"}
                </span>
              </div>
            </div>

            {exo.unite_actuelle !== "reps" && exo.charge_cible > 0 && !exo.series[0]?.validee && (
              <div className="flex gap-1 flex-wrap">
                {calculerEchauffement(exo.charge_cible, exo.unite_actuelle).map((w, wi) => (
                  <span key={wi} className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                    {w.label} ({w.charge} {exo.unite_actuelle})
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {exo.series.map((serie, serieIdx) => (
                <div key={serieIdx} className="flex items-center gap-1.5 p-2 rounded-xl" style={{ backgroundColor: serie.validee ? "rgba(245,158,11,0.08)" : "var(--color-gymx-bg)" }}>
                  <span className="text-xs font-mono w-5 shrink-0" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>S{serieIdx + 1}</span>
                  <div className="flex-1 flex items-center gap-1.5">
                    <input type="number" value={serie.reps} onChange={(e) => updateSerie(exoIdx, serieIdx, { reps: Number(e.target.value) || 0 })} onBlur={() => sauverSerie(exoIdx, serieIdx)} disabled={serie.validee} inputMode="numeric"
                      className="w-14 border rounded-xl px-2 py-1.5 text-center text-sm disabled:opacity-50 touch-target"
                      style={{ fontSize: "16px", borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-surface)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                    <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>réps</span>
                    {exo.unite_actuelle !== "reps" && (
                      <input type="number" value={serie.charge} onChange={(e) => updateSerie(exoIdx, serieIdx, { charge: Number(e.target.value) || 0 })} onBlur={() => sauverSerie(exoIdx, serieIdx)} disabled={serie.validee} inputMode="decimal"
                        className="w-16 border rounded-xl px-2 py-1.5 text-center text-sm disabled:opacity-50 touch-target"
                        style={{ fontSize: "16px", borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-surface)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                    )}
                    <button onClick={() => {
                      const idx = unitesDisponibles.indexOf(exo.unite_actuelle);
                      const next = unitesDisponibles[(idx + 1) % unitesDisponibles.length];
                      setExercices((prev) => { const n = [...prev]; n[exoIdx] = { ...n[exoIdx], unite_actuelle: next }; return n; });
                    }} className="text-[10px] font-semibold px-2 py-1 rounded transition-colors touch-target h-8"
                      style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>
                      {exo.unite_actuelle}
                    </button>
                  </div>
                  <button onClick={() => toggleSerie(exoIdx, serieIdx)}
                    className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 touch-target shrink-0"
                    style={{ backgroundColor: serie.validee ? "var(--color-gymx-accent)" : "var(--color-gymx-border)", color: serie.validee ? "#0a0a0b" : "var(--color-gymx-muted)" }}>
                    {serie.validee ? <span className="text-xs font-bold">✕</span> : <Check className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>

            {exo.series.every((s) => s.validee) && !exo.slider_submitted && (
              <div className="space-y-2 pt-3 border-t" style={{ borderColor: "var(--color-gymx-border)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--color-gymx-text)" }}>
                  C&apos;était comment&nbsp;? <span style={{ color: "var(--color-gymx-muted)" }}>(RPE 1-10)</span>
                </p>
                <div className="flex gap-1 overflow-x-auto pb-1 overscroll-contain" style={{ touchAction: "pan-x" }}>
                  {rpeLabels.map((r) => (
                    <button key={r.rpe} onClick={() => submitSlider(exoIdx, rpeToCran(r.rpe), r.rpe)}
                      className="flex flex-col items-center justify-center gap-0.5 py-2 px-2.5 rounded-xl border touch-target shrink-0"
                      style={{ minHeight: 48, minWidth: 36, borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-surface)" }}>
                      <span className="w-5 h-1 rounded-full" style={{ backgroundColor: rpeColors[r.rpe - 1] }} />
                      <span className="text-[10px] font-bold">{r.rpe}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-center" style={{ color: "var(--color-gymx-muted)" }}>
                  Facile (~4) · Dur (8) · Impossible (10)
                </p>
              </div>
            )}

            {exo.slider_submitted && (<p className="text-xs text-center" style={{ color: "var(--color-gymx-accent)" }}>✓ Effort enregistré</p>)}
          </div>
        ))}

        {chrono !== null && chrono > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 card px-4 py-2.5 flex items-center gap-3 z-50 animate-fade-in"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.4)", borderColor: chrono <= 10 ? "var(--color-gymx-accent)" : "var(--color-gymx-border)" }}>
            <Timer className="w-5 h-5 shrink-0" style={{ color: chrono <= 10 ? "var(--color-gymx-accent)" : "var(--color-gymx-text)" }} />
            <span className="font-mono font-bold text-lg" style={{ color: chrono <= 10 ? "var(--color-gymx-accent)" : "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>{formaterTemps(chrono)}</span>
            <button onClick={() => setChronoRunning(!chronoRunning)} className="p-1.5 touch-target rounded-xl transition-colors" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>
              {chronoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={() => setChrono(0)} className="p-1.5 touch-target rounded-xl transition-colors" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
              <span className="text-xs font-semibold px-1">✕</span>
            </button>
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 border-t bg-gymx-surface px-2 py-1 flex justify-around items-center z-50"
        style={{ borderColor: "var(--color-gymx-border)", paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (<Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors touch-target"
            style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
            <item.icon className="w-5 h-5" style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }} />
            <span className="text-[10px] font-semibold tracking-[0.04em]" style={{ fontFamily: "var(--font-body)" }}>{item.label}</span>
          </Link>);
        })}
      </nav>
    </div>
  );
}
