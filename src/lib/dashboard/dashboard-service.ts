import { createClient } from "@/lib/supabase/client";
import type { Niveau, GroupeMuscle } from "@/types";
import { getVolumeLandmarks, getVolumeStatus } from "@/lib/volume-landmarks";

/** Calcule le 1RM estimé — Brzycki (<10 reps) ou Epley (≥10) */
export function estimer1RM(charge: number, reps: number): number {
  if (reps <= 0 || charge <= 0) return 0;
  if (reps === 1) return charge;
  if (reps < 10) return Math.round(charge * (36 / (37 - reps))); // Brzycki
  if (reps <= 12) return Math.round(charge * (1 + reps / 30)); // Epley
  return charge;
}

/** Coefficient de progression par exercice (certains exos progressent plus vite) */
const COEFFS: Record<string, number> = {
  squat_barre: 1.0, souleve_de_terre: 1.2, developpe_couche_barre: 0.8,
  developpe_militaire_barre: 0.6, rowing_barre: 0.9, tractions: 0.7,
};

export function getCoeffExercice(slug: string): number {
  return COEFFS[slug] || 1.0;
}

/** Suggère des séries d'échauffement */
export function calculerEchauffement(charge: number, unite: string): { label: string; charge: number }[] {
  if (charge <= 0 || unite === "reps") return [];
  return [
    { label: "Barre vide", charge: 20 },
    { label: "50%", charge: Math.round(charge * 0.5 / 2.5) * 2.5 },
    { label: "70%", charge: Math.round(charge * 0.7 / 2.5) * 2.5 },
    { label: "90%", charge: Math.round(charge * 0.9 / 2.5) * 2.5 },
  ].filter((s) => s.charge < charge);
}

export async function getForceMax() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("series")
    .select(`
      charge, reps, exercice_id,
      seance:seance_id!inner(date),
      exercice:exercice_id!inner(nom_fr, groupe)
    `)
    .eq("validee", true)
    .order("created_at", { ascending: false });

  if (!data) return [];

  const bestPerExercise = new Map<string, { nom: string; charge: number; reps: number; date: string }>();

  for (const s of data as any[]) {
    const charge = Number(s.charge);
    const reps = Number(s.reps);
    if (charge <= 0 || reps <= 0) continue;
    const rm = estimer1RM(charge, reps);
    const existing = bestPerExercise.get(s.exercice_id);
    if (!existing || rm > estimer1RM(existing.charge, existing.reps)) {
      bestPerExercise.set(s.exercice_id, {
        nom: s.exercice.nom_fr,
        charge,
        reps,
        date: s.seance?.date || "",
      });
    }
  }

  return Array.from(bestPerExercise.entries()).map(([id, val]) => ({
    exercice_id: id,
    ...val,
    rm: estimer1RM(val.charge, val.reps),
  }));
}

export async function getVolumeSemaine(): Promise<{ groupe: string; sets: number; status: string; mev: number; mav_min: number; mav_max: number; mrv: number }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profil } = await supabase
    .from("profil")
    .select("niveau")
    .eq("user_id", user.id)
    .maybeSingle();
  const niveau: Niveau = profil?.niveau || "intermediaire";

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data } = await supabase
    .from("series")
    .select(`
      exercice_id,
      exercice:exercice_id!inner(groupe, nom_fr)
    `)
    .eq("validee", true)
    .gte("created_at", weekAgo.toISOString());

  if (!data) return [];

  const GROUPE_NORMALIZE: Record<string, GroupeMuscle> = {
    pectoraux: "pectoraux", Pectoraux: "pectoraux", PECTORAUX: "pectoraux",
    epaules: "epaules", Épaules: "epaules", EPAULES: "epaules",
    dos: "dos", Dos: "dos", DOS: "dos",
    quadriceps: "quadriceps", Quadriceps: "quadriceps", QUADRICEPS: "quadriceps",
    ["ischios/fessiers"]: "ischios_fessiers", ["Ischios/Fessiers"]: "ischios_fessiers",
    ischios_fessiers: "ischios_fessiers", Ischios_fessiers: "ischios_fessiers",
    biceps: "biceps", Biceps: "biceps", BICEPS: "biceps",
    triceps: "triceps", Triceps: "triceps", TRICEPS: "triceps",
    mollets: "mollets", Mollets: "mollets", MOLLETS: "mollets",
    abdos: "abdos", Abdos: "abdos", ABDOS: "abdos",
  };

  const volume = new Map<GroupeMuscle, { groupe: GroupeMuscle; sets: number }>();
  for (const s of data as any[]) {
    const raw = s.exercice.groupe;
    const g = GROUPE_NORMALIZE[raw] || "pectoraux";
    const v = volume.get(g) || { groupe: g, sets: 0 };
    v.sets += 1;
    volume.set(g, v);
  }

  return Array.from(volume.values()).map((v) => {
    const l = getVolumeLandmarks(v.groupe, niveau);
    if (!l) return { ...v, status: "trop_peu", mev: 0, mav_min: 0, mav_max: 0, mrv: 0 };
    return {
      ...v,
      status: getVolumeStatus(v.sets, v.groupe, niveau),
      mev: l.mev,
      mav_min: l.mav_min,
      mav_max: l.mav_max,
      mrv: l.mrv,
    };
  });
}

export async function getFrequenceMuscles() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data } = await supabase
    .from("series")
    .select(`
      exercice:exercice_id!inner(groupe),
      seance:seance_id!inner(date)
    `)
    .eq("validee", true)
    .gte("seance.date", weekAgo.toISOString().split("T")[0]);

  if (!data) return [];

  const freq = new Map<string, Set<string>>();
  for (const s of data as any[]) {
    const g = s.exercice.groupe;
    if (!freq.has(g)) freq.set(g, new Set());
    freq.get(g)!.add(s.seance.date);
  }

  return Array.from(freq.entries()).map(([groupe, jours]) => ({
    groupe,
    fois: jours.size,
    ok: jours.size >= 2,
  }));
}

export async function getEffortMoyen() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { moyenne: 0, total: 0, trop_dur: false, fatigue_score: 0, tendance: "stable" };

  const { data } = await supabase
    .from("effort")
    .select("valeur, seance:seance_id!inner(date)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return { moyenne: 0, total: 0, trop_dur: false, fatigue_score: 0, tendance: "stable" };

  const avg = data.reduce((sum: number, e: any) => sum + e.valeur, 0) / data.length;
  const hardCount = data.filter((e: any) => e.valeur >= 9).length;
  const trop_dur = hardCount > data.length * 0.3;

  const dernieres3 = data.slice(0, 3).reduce((s: number, e: any) => s + e.valeur, 0) / 3;
  const avant3 = data.length >= 6 ? data.slice(3, 6).reduce((s: number, e: any) => s + e.valeur, 0) / 3 : dernieres3;
  const tendance: "hausse" | "baisse" | "stable" = dernieres3 > avant3 + 0.5 ? "hausse" : dernieres3 < avant3 - 0.5 ? "baisse" : "stable";

  const fatigue_score = Math.round((avg * 0.6 + (trop_dur ? 3 : 0) + (tendance === "hausse" ? 1.5 : 0)) * 10) / 10;

  return {
    moyenne: Math.round(avg * 10) / 10,
    total: data.length,
    trop_dur,
    fatigue_score: Math.min(10, fatigue_score),
    tendance,
  };
}

export async function getRegularite() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { streak: 0, taux: 0 };

  const { data: prog } = await supabase
    .from("programme_actif")
    .select("jours_par_semaine, date_debut")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!prog) return { streak: 0, taux: 0 };

  const { data: seances } = await supabase
    .from("seances")
    .select("date, terminee")
    .eq("user_id", user.id)
    .eq("terminee", true)
    .order("date", { ascending: false })
    .limit(30);

  if (!seances || seances.length === 0) return { streak: 0, taux: 0 };

  const todayDate = new Date();
  const datesUniques = Array.from(new Set((seances as any[]).map((s: any) => s.date)))
    .sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());

  let streak = 0;
  let expectedDate = new Date(todayDate);
  for (const dateStr of datesUniques) {
    const d = new Date(dateStr + "T00:00:00");
    const diff = Math.round((expectedDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0 || diff === 1) {
      streak++;
      expectedDate = d;
    } else break;
  }

  const totalDays = Math.max(
    1,
    Math.round((new Date().getTime() - new Date(prog.date_debut + "T00:00:00").getTime())
    / (1000 * 60 * 60 * 24))
  );
  const expectedSessions = Math.round((totalDays / 7) * prog.jours_par_semaine);
  const taux = Math.round((seances.length / Math.max(1, expectedSessions)) * 100);

  return { streak, taux };
}

export interface FatigueMuscle {
  groupe: string;
  recup_pct: number;
  jours_depuis: number;
  dernier_rpe: number | null;
}

export async function getFatigueParMuscle(userId: string): Promise<FatigueMuscle[]> {
  const supabase = createClient();

  const SEUILS: Record<string, { recup_jours: number }> = {
    Pectoraux: { recup_jours: 2 }, Épaules: { recup_jours: 2 }, Triceps: { recup_jours: 1.5 },
    Dos: { recup_jours: 2.5 }, Biceps: { recup_jours: 1.5 },
    Quadriceps: { recup_jours: 2.5 }, ["Ischios/Fessiers"]: { recup_jours: 2.5 },
    Mollets: { recup_jours: 1.5 }, Abdos: { recup_jours: 1.5 },
  };

  const groupes = Object.keys(SEUILS);
  const maintenant = new Date();
  const resultats: FatigueMuscle[] = [];

  for (const groupe of groupes) {
    const { data: serie } = await supabase
      .from("series")
      .select("created_at, exercice:exercice_id!inner(groupe), seance:seance_id!inner(id)")
      .eq("exercice.groupe", groupe)
      .eq("validee", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!serie) {
      resultats.push({ groupe, recup_pct: 100, jours_depuis: 99, dernier_rpe: null });
      continue;
    }

    const dateSerie = new Date((serie as any).created_at);
    const joursDepuis = Math.max(0, (maintenant.getTime() - dateSerie.getTime()) / (1000 * 60 * 60 * 24));

    const { data: effort } = await supabase
      .from("effort")
      .select("valeur")
      .eq("seance_id", (serie as any).seance_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const rpe = (effort as any)?.valeur || 5;
    const recupJours = SEUILS[groupe]?.recup_jours || 2;
    const recupPct = Math.min(100, Math.round((joursDepuis / recupJours) * 100));

    resultats.push({ groupe, recup_pct: recupPct, jours_depuis: Math.round(joursDepuis * 10) / 10, dernier_rpe: rpe });
  }

  return resultats;
}

export async function getPoidsCorps() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("poids_corps")
    .select("date, poids")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(30);

  return (data || []).map((d: any) => ({ date: d.date, poids: Number(d.poids) }));
}

export interface SuggestionVariation {
  exercice_id: string;
  nom: string;
  groupe: string;
  nbSeances: number;
  chargeStable: boolean;
  rpeStable: boolean;
}

export async function getStaleExercices(userId: string): Promise<SuggestionVariation[]> {
  const supabase = createClient();

  const { data: prog } = await supabase.from("programme_actif").select("id").eq("user_id", userId).maybeSingle();
  if (!prog) return [];

  const { data: structures } = await supabase
    .from("programme_structure")
    .select("exercice_id")
    .eq("programme_actif_id", prog.id)
    .eq("role", "principal");

  if (!structures) return [];

  const suggestions: SuggestionVariation[] = [];

  for (const s of structures) {
    const { data: series } = await supabase
      .from("series")
      .select("charge, created_at, seance:seance_id!inner(date)")
      .eq("exercice_id", s.exercice_id)
      .eq("validee", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!series || series.length < 3) continue;

    const datesUniques = new Set((series as any[]).map((ser: any) => ser.seance?.date)).size;
    if (datesUniques < 3) continue;

    const { data: exo } = await supabase.from("exercices").select("nom_fr, groupe").eq("id", s.exercice_id).single();
    if (!exo) continue;

    const charges = (series as any[]).map((ser: any) => Number(ser.charge));
    const chargeStable = charges.length >= 3 && charges.slice(0, 3).every((c: number) => c === charges[0]);

    const { data: efforts } = await supabase
      .from("effort")
      .select("valeur")
      .eq("exercice_id", s.exercice_id)
      .order("created_at", { ascending: false })
      .limit(3);

    const rpeStable = efforts && efforts.length >= 3 && (efforts as any[]).every((e: any) => e.valeur >= 7);

    if (chargeStable || rpeStable) {
      suggestions.push({
        exercice_id: s.exercice_id,
        nom: exo.nom_fr,
        groupe: exo.groupe,
        nbSeances: datesUniques,
        chargeStable,
        rpeStable: !!rpeStable,
      });
    }
  }

  return suggestions;
}
