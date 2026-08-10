"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculerProgressionRPE, suggererCharge, getRepRange, getPas } from "@/lib/progression/engine";
import { calculerEchauffement, getCoeffExercice } from "@/lib/dashboard/dashboard-service";
import { initialiserGamification, ajouterXP, verifierRecords, verifierQuetes, badgeIcon, badgeLabel, getNiveauLabel } from "@/lib/gamification/gamification-service";
import { getOrCreateSeanceDuJour } from "@/lib/seance/seance-service";
import { faireRotation } from "@/lib/programme/rotation-service";
import { incrementerSemaine } from "@/lib/programme/cycles";
import { SkeletonCard } from "@/components/skeleton";
import { Check, Timer, Play, Pause, BarChart3, Dumbbell, Library, TrendingUp, User, RefreshCw } from "lucide-react";
import type { Cran, Exercice, Niveau, Objectif } from "@/types";
import Link from "next/link";

interface SerieLog { id?: string; exercice_id: string; reps: number; charge: number; validee: boolean; ordre: number; }
interface ExerciceEnCours {
  exercice: Exercice; structure_id: string | null; series_cibles: number; reps_cibles: number;
  charge_cible: number; charge_suggeree: number; pas_suggere: number; role: string; fige: boolean;
  series: SerieLog[]; slider: Cran | null; slider_submitted: boolean; unite_actuelle: string;
  chauffe: boolean[];
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
  const [saved, setSaved] = useState(false);
  const savingSeries = useRef(new Set<string>());
  const chronoExoId = useRef<string | null>(null);
  const debutSeance = useRef<number | null>(null);
  const userRef = useRef<any>(null);
  const profilRef = useRef<{ niveau: Niveau; objectif: Objectif }>({ niveau: "intermediaire", objectif: "muscle" });
  const [showAddExo, setShowAddExo] = useState(false);
  const [addExoList, setAddExoList] = useState<any[]>([]);
  const [addExoSearch, setAddExoSearch] = useState("");
  const [addExoFilter, setAddExoFilter] = useState<string | null>(null);
  const [addExoLoading, setAddExoLoading] = useState(false);
  const pathname = "/seance";

  const groupesList = ["Pectoraux", "Épaules", "Dos", "Quadriceps", "Ischios/Fessiers", "Biceps", "Triceps", "Mollets", "Abdos"];

  const ajouterExercice = async (exo: any) => {
    const user = userRef.current;
    if (!user || !seanceId) return;
    const exoId = exo.id;
    const existe = exercices.some((e) => e.exercice.id === exoId);
    if (existe) return;

    const { data: charge } = await supabase
      .from("charges")
      .select("*")
      .eq("user_id", user.id)
      .eq("exercice_id", exoId)
      .maybeSingle();

    const chargeCible = charge?.charge_actuelle ?? 0;
    if (!charge) {
      await supabase.from("charges").insert({
        user_id: user.id, exercice_id: exoId, charge_actuelle: 0,
        unite: exo.unite_par_defaut, pas: exo.pas_par_defaut,
        sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0,
      });
    }

    const { data: lastEffort } = await supabase
      .from("effort")
      .select("valeur")
      .eq("user_id", user.id)
      .eq("exercice_id", exoId)
      .neq("seance_id", seanceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dernierRPE = (lastEffort as any)?.valeur || null;

    const { niveau, objectif } = profilRef.current;
    const sugg = suggererCharge(chargeCible, dernierRPE, { compound: exo.compound, role: "accessoire" }, niveau, objectif);
    const chauffeSteps = calculerEchauffement(chargeCible, exo.unite_par_defaut || "kg");
    const newExo: ExerciceEnCours = {
      exercice: exo, structure_id: null, series_cibles: 3, reps_cibles: 10,
      charge_cible: chargeCible, charge_suggeree: sugg.charge, pas_suggere: sugg.pas,
      role: "accessoire", fige: false,
      series: Array.from({ length: 3 }, (_, i) => ({ exercice_id: exoId, reps: 10, charge: chargeCible, validee: false, ordre: i })),
      slider: null, slider_submitted: false, unite_actuelle: exo.unite_par_defaut || "kg",
      chauffe: chauffeSteps.map(() => false),
    };
    setExercices((prev) => [...prev, newExo]);
    setShowAddExo(false);
  };

  const addExoAleatoire = async () => {
    const user = userRef.current;
    if (!user) return;
    const idsDansSeance = new Set(exercices.map((e) => e.exercice.id));
    const dispo = addExoList.filter((e) => !idsDansSeance.has(e.id));
    if (dispo.length === 0) { setMessage("Aucun exercice disponible"); setTimeout(() => setMessage(""), 2000); return; }
    const alea = dispo[Math.floor(Math.random() * dispo.length)];
    await ajouterExercice(alea);
  };

  const chargerListeExos = async () => {
    if (addExoList.length > 0) { setShowAddExo(true); return; }
    const user = userRef.current;
    setAddExoLoading(true);
    let q: any = supabase.from("exercices").select("*").order("nom_fr");
    if (user) {
      const { data: p } = await supabase.from("profil").select("materiel").eq("user_id", user.id).maybeSingle();
      const { data: exclus } = await supabase.from("exercices_exclus").select("exercice_id").eq("user_id", user.id);
      const exclusSet = new Set((exclus || []).map((e: any) => e.exercice_id));
      if (p?.materiel) q = q.eq("equipement", p.materiel);
      const { data } = await q;
      if (data) {
        const dansSeanceIds = new Set(exercices.map((e) => e.exercice.id));
        const filtered = data.filter((e: any) => !exclusSet.has(e.id) && !dansSeanceIds.has(e.id));
        setAddExoList(filtered);
      }
    } else {
      const { data } = await q;
      if (data) setAddExoList(data);
    }
    setAddExoLoading(false);
    setShowAddExo(true);
  };

  const chargerSeance = useCallback(async () => {
    const result = await getOrCreateSeanceDuJour();
    if (!result) { const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.push("/login"); return; } setNoProfil(true); setLoading(false); return; }
    setSeanceId(result.seance.id);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    let exclusSet = new Set<string>();
    let profilNiveau: Niveau = "intermediaire";
    let profilObjectif: Objectif = "muscle";
    if (currentUser) {
      userRef.current = currentUser;
      const { data: exclus } = await supabase.from("exercices_exclus").select("exercice_id").eq("user_id", currentUser.id);
      exclusSet = new Set((exclus || []).map((e: any) => e.exercice_id));
      const { data: p } = await supabase.from("profil").select("niveau, objectif").eq("user_id", currentUser.id).maybeSingle();
      if (p) { profilNiveau = p.niveau; profilObjectif = p.objectif; profilRef.current = { niveau: p.niveau, objectif: p.objectif }; }
    }

    const { data: prog } = await supabase.from("programme_actif").select("*").single();
    if (!prog) { setNoProgramme(true); setLoading(false); return; }
    const { data: structures } = await supabase.from("programme_structure").select("id, exercice_id, ordre, series_cibles, reps_cibles, role, fige")
      .eq("programme_actif_id", prog.id).eq("jour", result.seance.jour_du_programme).order("ordre");
    if (!structures || structures.length === 0) { setNoProgramme(true); setLoading(false); return; }

    const allIds = structures.map((s: any) => s.exercice_id);
    const [{ data: allExercises }, { data: allCharges }] = await Promise.all([
      supabase.from("exercices").select("*").in("id", allIds),
      supabase.from("charges").select("*").in("exercice_id", allIds).eq("user_id", prog.user_id),
    ]);
    const exoMap = new Map((allExercises || []).map((e: any) => [e.id, e]));
    const chargeMap = new Map((allCharges || []).map((c: any) => [c.exercice_id, c]));

    let seriesParExo = new Map<string, SerieLog[]>();
    if (!result.nouvelle && result.exercices.length > 0) {
      for (const serie of result.exercices) {
        const key = serie.exercice_id;
        if (!seriesParExo.has(key)) seriesParExo.set(key, []);
        seriesParExo.get(key)!.push({ id: serie.id, exercice_id: serie.exercice_id, reps: serie.reps, charge: serie.charge, validee: serie.validee, ordre: serie.ordre });
      }
    }

    const efforts = result.efforts || [];
    const exosAvecCharges: ExerciceEnCours[] = [];
    const chargesToInsert: any[] = [];

    for (const s of structures) {
      let exo: any = exoMap.get(s.exercice_id) || null;
      if (exo && exclusSet.has(exo.id)) {
        const newId = await faireRotation(s.id, exo.id, exo.sous_region, s.fige, true, exo.groupe);
        if (newId) {
          exo = exoMap.get(newId);
          if (!exo) {
            const { data: newExo } = await supabase.from("exercices").select("*").eq("id", newId).single();
            if (newExo) { exo = newExo; exoMap.set(newId, newExo); }
          }
        }
      }
      let chargeCible = 0;
      if (exo) {
        const charge: any = chargeMap.get(exo.id);
        chargeCible = charge?.charge_actuelle ?? 0;
        if (!charge) chargesToInsert.push({ user_id: prog.user_id, exercice_id: exo.id, charge_actuelle: 0, unite: exo.unite_par_defaut, pas: exo.pas_par_defaut, sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0 });
      }
      const exoId = exo?.id || s.exercice_id;
      const series = seriesParExo.get(exoId) || Array.from({ length: s.series_cibles }, (_, i) => ({ exercice_id: exoId, reps: s.reps_cibles, charge: chargeCible, validee: false, ordre: i }));
      const effortExo = efforts.find((e: any) => e.exercice_id === exoId);
      const { data: lastEffort } = currentUser ? await supabase.from("effort").select("valeur").eq("user_id", currentUser.id).eq("exercice_id", exoId).neq("seance_id", result.seance.id).order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
      const dernierRPE = (lastEffort as any)?.valeur || null;
      const sugg = suggererCharge(chargeCible, dernierRPE, { compound: exo?.compound || false, role: s.role }, profilNiveau, profilObjectif);
      const chauffeSteps = calculerEchauffement(chargeCible, exo?.unite_par_defaut || "kg");
      exosAvecCharges.push({ exercice: exo || ({} as Exercice), structure_id: s.id, series_cibles: s.series_cibles, reps_cibles: s.reps_cibles, charge_cible: chargeCible, charge_suggeree: sugg.charge, pas_suggere: sugg.pas, role: s.role, fige: s.fige, series, slider: effortExo?.cran || null, slider_submitted: !!effortExo, unite_actuelle: exo?.unite_par_defaut || "kg", chauffe: chauffeSteps.map(() => false) });
    }

    for (const charge of chargesToInsert) await supabase.from("charges").insert(charge);
    setExercices(exosAvecCharges);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { chargerSeance(); }, [chargerSeance]);
  const timerStartedAt = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && timerStartedAt.current !== null && chrono !== null) {
        const elapsed = Math.floor((Date.now() - timerStartedAt.current) / 1000);
        const remaining = Math.max(0, chrono - elapsed);
        setChrono(remaining);
        timerStartedAt.current = Date.now();
        if (remaining <= 0) setChronoRunning(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [chrono]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (chronoRunning && chrono !== null && chrono > 0) {
      timerStartedAt.current = Date.now();
      interval = setInterval(() => { setChrono((p) => (p !== null ? Math.max(0, p - 1) : null)); }, 1000);
    }
    if (chrono === 0) setChronoRunning(false);
    return () => { if (interval) clearInterval(interval); };
  }, [chronoRunning, chrono]);

  const updateSerie = (exoIdx: number, serieIdx: number, updates: Partial<SerieLog>) => {
    setExercices((prev) => { const n = [...prev]; n[exoIdx] = { ...n[exoIdx], series: n[exoIdx].series.map((s, i) => i === serieIdx ? { ...s, ...updates } : s) }; return n; });
  };

  const sauverSerie = async (exoIdx: number, serieIdx: number) => {
    if (!seanceId) return;
    const exo = exercices[exoIdx];
    const serie = exo.series[serieIdx];
    const key = `${serie.exercice_id}-${serieIdx}`;
    if (savingSeries.current.has(key)) return;
    savingSeries.current.add(key);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { savingSeries.current.delete(key); return; }
    await supabase.from("series").upsert({
      seance_id: seanceId,
      exercice_id: serie.exercice_id,
      reps: serie.reps,
      charge: serie.charge,
      unite: exo.unite_actuelle,
      validee: serie.validee,
      ordre: serie.ordre,
    });
    savingSeries.current.delete(key);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const toggleSerie = async (exoIdx: number, serieIdx: number) => {
    const exo = exercices[exoIdx];
    const serie = exo.series[serieIdx];
    const nouvelleValeur = !serie.validee;
    setExercices((prev) => {
      const n = [...prev];
      n[exoIdx] = { ...n[exoIdx], series: n[exoIdx].series.map((s, i) => i === serieIdx ? { ...s, validee: nouvelleValeur } : s) };
      return n;
    });
    if (nouvelleValeur && debutSeance.current === null) debutSeance.current = Date.now();
    if (nouvelleValeur) {
      chronoExoId.current = exo.exercice.id;
      const savedRest = localStorage.getItem(`rest_${exo.exercice.id}`);
      setChrono(savedRest ? Number(savedRest) : resteRepos(exo.role));
      setChronoRunning(true);
    }
    await sauverSerie(exoIdx, serieIdx);
  };

  const formaterTemps = (s: number): string => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSwap = async (exoIdx: number) => {
    try {
      const exo = exercices[exoIdx];
      if (!seanceId || !exo.structure_id) return;
      const nextId = await faireRotation(exo.structure_id, exo.exercice.id, exo.exercice.sous_region, exo.fige, true, exo.exercice.groupe);
      if (!nextId) { setMessage("Aucun remplacement disponible"); setTimeout(() => setMessage(""), 2000); return; }
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
          charge_suggeree: chargeCible,
          pas_suggere: getPas({ compound: nextExo.compound, role: n[exoIdx].role }),
          series: Array.from({ length: n[exoIdx].series_cibles }, (_, i) => ({ exercice_id: nextId, reps: n[exoIdx].reps_cibles, charge: chargeCible, validee: false, ordre: i })),
          slider: null, slider_submitted: false, unite_actuelle: nextExo.unite_par_defaut || "kg",
          chauffe: calculerEchauffement(chargeCible, nextExo.unite_par_defaut || "kg").map(() => false),
        };
        return n;
      });
      setMessage(`↻ ${nextExo.nom_fr}`);
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage("Erreur lors du remplacement");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const submitSlider = async (exoIdx: number, cran: Cran, rpeValue?: number) => {
    if (!seanceId) return;
    const exo = exercices[exoIdx];
    const memeValeur = exo.slider === cran && exo.slider_submitted;
    if (memeValeur) return;
    const rpe = rpeValue || (cran === "facile" ? 4 : cran === "ca_passe" ? 6 : cran === "dur" ? 8 : cran === "a_la_limite" ? 9 : 10);
    setExercices((prev) => { const n = [...prev]; n[exoIdx] = { ...n[exoIdx], slider: cran, slider_submitted: true }; return n; });
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("effort").upsert({ user_id: user!.id, seance_id: seanceId, exercice_id: exo.exercice.id, valeur: rpe, cran });
    const { data: chargeData } = await supabase.from("charges").select("*").eq("user_id", user!.id).eq("exercice_id", exo.exercice.id).single();
    if (!chargeData) return;
    const { data: profil } = await supabase.from("profil").select("niveau").eq("user_id", user!.id).single();

    const { data: historique } = await supabase.from("effort").select("valeur").eq("user_id", user!.id).eq("exercice_id", exo.exercice.id).order("created_at", { ascending: false }).limit(5);
    const historiqueRPE = (historique || []).map((e: any) => e.valeur).reverse();

    const pasReel = exercices[exoIdx]?.pas_suggere || chargeData.pas;
    const resultat = calculerProgressionRPE(rpe, profil?.niveau || "intermediaire", { unite: chargeData.unite, pas: pasReel, sens: chargeData.sens, compteur_echecs: chargeData.compteur_echecs }, chargeData.charge_actuelle, historiqueRPE);
    await supabase.from("charges").update({ charge_actuelle: resultat.nouvelle_charge, compteur_echecs: resultat.nouveau_compteur_echecs, pas: pasReel }).eq("id", chargeData.id);
    if (exo.role === "accessoire" && !exo.fige && exo.structure_id) { await faireRotation(exo.structure_id, exo.exercice.id, exo.exercice.sous_region, exo.fige, false, exo.exercice.groupe); }
    const { data: derniereSeance } = await supabase
      .from("effort")
      .select("valeur, seance:seance_id!inner(id)")
      .eq("user_id", user!.id)
      .eq("exercice_id", exo.exercice.id)
      .neq("seance_id", seanceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (derniereSeance) {
      const ancienRPE = (derniereSeance as any).valeur;
      const diffRPE = rpe - ancienRPE;
      if (diffRPE >= 2) setMessage(`⚠ RPE +${diffRPE} vs dernière fois — fatigue ou charge trop lourde ?`);
      else if (diffRPE <= -2) setMessage(`✓ RPE ${diffRPE > 0 ? "+" : ""}${diffRPE} vs dernière fois — progrès !`);
    }

    if (resultat.plateau_detecte || resultat.deload_suggere) {
      setMessage(`⚠ ${resultat.deload_suggere ? "Semaine allégée recommandée" : "Plateau détecté"}`);
      setTimeout(() => setMessage(""), 4000);
    }
  };

  const sauverSeance = async () => {
    if (!seanceId) return; setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    let xpGagne = 0; let nouveauRecord = false;

    try {
      for (const exo of exercices) {
        for (const serie of exo.series) {
          if (serie.validee) {
            const { error } = await supabase.from("series").upsert({ seance_id: seanceId, exercice_id: serie.exercice_id, reps: serie.reps, charge: serie.charge, unite: exo.unite_actuelle, validee: true, ordre: serie.ordre });
            if (error) throw new Error("Erreur sauvegarde séries");
            const estRecord = await verifierRecords(user.id, serie.exercice_id, serie.charge, serie.reps);
            if (estRecord) { nouveauRecord = true; xpGagne += 100; }
          }
        }
      }

      const dureeReelle = debutSeance.current ? Math.round((Date.now() - debutSeance.current) / 1000) : 0;
      const { error: seanceError } = await supabase.from("seances").update({ terminee: true, duree: dureeReelle }).eq("id", seanceId);
      if (seanceError) throw new Error("Erreur finalisation séance");

      xpGagne += 50;
      await initialiserGamification(user.id);
      if (xpGagne > 0) await ajouterXP(user.id, xpGagne, "séance terminée");
      await incrementerSemaine(user.id);

      const { data: g } = await supabase.from("gamification").select("*").eq("user_id", user.id).single();
      if (g) {
        const newStreak = g.streak + 1;
        await supabase.from("gamification").update({ streak: newStreak }).eq("id", g.id);
      }

      const { badgeDecroche } = await verifierQuetes(user.id);

      setSaving(false);
      let msg = "";
      if (badgeDecroche) msg = `${badgeIcon(badgeDecroche)} Badge : ${badgeLabel(badgeDecroche)} !`;
      else if (nouveauRecord) msg = `🏆 Record battu ! +${xpGagne} XP`;
      else msg = `+${xpGagne} XP gagné`;
      setMessage(msg);
      fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          title: badgeDecroche ? `${badgeIcon(badgeDecroche)} Badge débloqué !` : "Séance terminée",
          body: msg,
          url: "/qg",
        }),
      }).catch(() => {});
      setTimeout(() => router.push("/qg"), 1200);
    } catch (e) {
      setMessage("Erreur lors de la sauvegarde — réessaie");
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) return (<div className="min-h-dvh flex flex-col p-4 space-y-3" style={{ minHeight: "100dvh" }}><SkeletonCard /><SkeletonCard /><SkeletonCard lines={2} /></div>);
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
            <p className="text-[9px] transition-opacity duration-300" style={{ color: "var(--color-gymx-accent)", opacity: saved ? 1 : 0 }}>✓ Sauvegardé</p>
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
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="label text-[10px]">{exo.role === "principal" ? "Principal" : "Accessoire"}</p>
                  {exo.structure_id && !exo.series.every((s) => s.validee) && (
                    <button onClick={() => handleSwap(exoIdx)} className="flex items-center gap-0.5 text-[10px] font-medium transition-colors touch-target opacity-50 hover:opacity-100"
                      style={{ color: "var(--color-gymx-muted)" }}>
                      <RefreshCw className="w-3 h-3" /> Remplacer
                    </button>
                  )}
                </div>
              </div>
              <span className="text-sm font-mono font-medium shrink-0" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>
                {exo.charge_suggeree > 0 ? (
                  <div className="text-right">
                    <span className="text-sm font-mono font-medium" style={{ color: "var(--color-gymx-accent)", fontFamily: "var(--font-mono)" }}>
                      {exo.charge_suggeree} {exo.unite_actuelle}
                    </span>
                    <span className="text-[9px] ml-1" style={{ color: "var(--color-gymx-muted)" }}>
                      (+{exo.pas_suggere})
                    </span>
                  </div>
                ) : exo.charge_cible > 0 ? `${exo.charge_cible} ${exo.unite_actuelle}` : "—"}
              </span>
            </div>

            {exo.unite_actuelle !== "reps" && exo.charge_cible > 0 && !exo.series[0]?.validee && exo.chauffe.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {calculerEchauffement(exo.charge_cible, exo.unite_actuelle).map((w, wi) => (
                  <button key={wi} onClick={() => {
                    setExercices((prev) => {
                      const n = [...prev];
                      n[exoIdx] = { ...n[exoIdx], chauffe: n[exoIdx].chauffe.map((c, ci) => ci === wi ? !c : c) };
                      return n;
                    });
                  }}
                    className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded touch-target transition-all"
                    style={{
                      backgroundColor: exo.chauffe[wi] ? "var(--color-gymx-accent)" : "var(--color-gymx-border)",
                      color: exo.chauffe[wi] ? "#0a0a0b" : "var(--color-gymx-muted)",
                    }}>
                    {exo.chauffe[wi] ? "✓" : ""} {w.label} ({w.charge} {exo.unite_actuelle})
                  </button>
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

            {exo.series.every((s) => s.validee) && (
              <div className="space-y-2 pt-3 border-t" style={{ borderColor: "var(--color-gymx-border)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: "var(--color-gymx-text)" }}>
                    C&apos;était comment&nbsp;? <span style={{ color: "var(--color-gymx-muted)" }}>(RPE 1-10)</span>
                  </p>
                  {exo.slider_submitted && (
                    <span className="text-[9px]" style={{ color: "var(--color-gymx-accent)" }}>✓ {exo.slider}</span>
                  )}
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1 overscroll-contain" style={{ touchAction: "pan-x" }}>
                  {rpeLabels.map((r) => {
                    const cran = rpeToCran(r.rpe);
                    const estSelectionne = exo.slider === cran && exo.slider_submitted;
                    return (
                      <button key={r.rpe} onClick={() => submitSlider(exoIdx, cran, r.rpe)}
                        className="flex flex-col items-center justify-center gap-0.5 py-2 px-2.5 rounded-xl border touch-target shrink-0"
                        style={{
                          minHeight: 48, minWidth: 36,
                          borderColor: estSelectionne ? "var(--color-gymx-accent)" : "var(--color-gymx-border)",
                          backgroundColor: estSelectionne ? "rgba(245,158,11,0.12)" : "var(--color-gymx-surface)",
                        }}>
                        <span className="w-5 h-1 rounded-full" style={{ backgroundColor: rpeColors[r.rpe - 1] }} />
                        <span className="text-[10px] font-bold">{r.rpe}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-center" style={{ color: "var(--color-gymx-muted)" }}>
                  Facile (~4) · Dur (8) · Impossible (10)
                </p>
              </div>
            )}
          </div>
        ))}

        {!saving && exercices.length > 0 && (
          <div className="flex gap-2">
            <button onClick={chargerListeExos} disabled={addExoLoading}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold touch-target disabled:opacity-30"
              style={{ border: "1px solid var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
              + Ajouter
            </button>
            <button onClick={addExoAleatoire} disabled={addExoLoading || addExoList.length === 0}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold touch-target disabled:opacity-30"
              style={{ border: "1px solid var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
              Aléatoire
            </button>
          </div>
        )}

        {showAddExo && (
          <div className="fixed inset-0 z-50 flex flex-col safe-area-top safe-area-bottom" style={{ backgroundColor: "var(--color-gymx-bg)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-gymx-border)" }}>
              <button onClick={() => setShowAddExo(false)} className="p-2 -ml-2 touch-target">
                <span className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Annuler</span>
              </button>
              <h2 className="card-title">Ajouter un exercice</h2>
              <div className="w-14" />
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 card px-3 py-2.5">
                <input type="text" value={addExoSearch} onChange={(e) => setAddExoSearch(e.target.value)}
                  placeholder="Rechercher..." className="flex-1 bg-transparent text-sm outline-none"
                  style={{ fontSize: "16px", color: "var(--color-gymx-text)" }} />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                <button onClick={() => setAddExoFilter(null)}
                  className={"shrink-0 px-3 py-2 rounded-full text-[10px] font-semibold border touch-target " + (!addExoFilter ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted")}>Tous</button>
                {groupesList.map((g) => (
                  <button key={g} onClick={() => setAddExoFilter(g === addExoFilter ? null : g)}
                    className={"shrink-0 px-3 py-2 rounded-full text-[10px] font-semibold border touch-target " + (addExoFilter === g ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted")}>{g}</button>
                ))}
              </div>
              {addExoLoading ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--color-gymx-muted)" }}>Chargement...</p>
              ) : (
                <div className="space-y-2">
                  {addExoList.filter((exo: any) => {
                    if (addExoFilter && exo.groupe !== addExoFilter) return false;
                    if (addExoSearch && !exo.nom_fr.toLowerCase().includes(addExoSearch.toLowerCase())) return false;
                    return true;
                  }).map((exo: any) => {
                    const dejaDansSeance = exercices.some((e) => e.exercice.id === exo.id);
                    return (
                      <div key={exo.id} className="card p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gymx-text truncate">{exo.nom_fr}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>{exo.groupe}</span>
                            <span className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>{exo.equipement === "salle" ? "Salle" : exo.equipement === "halteres" ? "Haltères" : "Corps"}</span>
                          </div>
                        </div>
                        <button onClick={() => ajouterExercice(exo)} disabled={dejaDansSeance}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold touch-target disabled:opacity-30 shrink-0"
                          style={{ backgroundColor: dejaDansSeance ? "var(--color-gymx-fill)" : "var(--color-gymx-accent)", color: dejaDansSeance ? "var(--color-gymx-muted)" : "#0a0a0b" }}>
                          {dejaDansSeance ? "Déjà ajouté" : "Ajouter"}
                        </button>
                      </div>
                    );
                  })}
                  {addExoList.filter((exo: any) => {
                    if (addExoFilter && exo.groupe !== addExoFilter) return false;
                    if (addExoSearch && !exo.nom_fr.toLowerCase().includes(addExoSearch.toLowerCase())) return false;
                    return true;
                  }).length === 0 && (
                    <p className="text-sm text-center py-6" style={{ color: "var(--color-gymx-muted)" }}>Aucun exercice trouvé.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {chrono !== null && chrono > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 card px-4 py-2.5 flex items-center gap-3 z-50 animate-fade-in"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.4)", borderColor: chrono <= 10 ? "var(--color-gymx-accent)" : "var(--color-gymx-border)" }}>
            <button onClick={() => {
              if (chronoExoId.current) {
                const nv = Math.max(15, chrono - 15);
                setChrono(nv);
                localStorage.setItem(`rest_${chronoExoId.current}`, String(nv));
              }
            }} className="p-1 touch-target rounded-lg shrink-0 text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>-15s</button>
            <Timer className="w-5 h-5 shrink-0" style={{ color: chrono <= 10 ? "var(--color-gymx-accent)" : "var(--color-gymx-text)" }} />
            <span className="font-mono font-bold text-lg" style={{ color: chrono <= 10 ? "var(--color-gymx-accent)" : "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>{formaterTemps(chrono)}</span>
            <button onClick={() => setChronoRunning(!chronoRunning)} className="p-1.5 touch-target rounded-xl transition-colors" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>
              {chronoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={() => {
              if (chronoExoId.current) {
                const nv = chrono + 15;
                setChrono(nv);
                localStorage.setItem(`rest_${chronoExoId.current}`, String(nv));
              }
            }} className="p-1 touch-target rounded-lg shrink-0 text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>+15s</button>
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
