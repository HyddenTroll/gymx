import { createClient } from "@/lib/supabase/client";

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

export async function getVolumeSemaine() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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

  const volume = new Map<string, { groupe: string; sets: number }>();
  for (const s of data as any[]) {
    const g = s.exercice.groupe;
    const v = volume.get(g) || { groupe: g, sets: 0 };
    v.sets += 1;
    volume.set(g, v);
  }

  return Array.from(volume.values()).map((v) => ({
    ...v,
    status: v.sets < 10 ? "trop_peu" : v.sets <= 20 ? "ideal" : "trop" as const,
  }));
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
  if (!user) return { moyenne: 0, total: 0, trop_dur: false };

  const { data } = await supabase
    .from("effort")
    .select("valeur, seance:seance_id!inner(date)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return { moyenne: 0, total: 0, trop_dur: false };

  const recent = data.slice(0, 10);
  const avg = recent.reduce((sum: number, e: any) => sum + e.valeur, 0) / recent.length;

  const hardCount = data.filter((e: any) => e.valeur >= 9).length;

  return {
    moyenne: Math.round(avg * 10) / 10,
    total: data.length,
    trop_dur: hardCount > data.length * 0.3,
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

  let streak = 0;
  for (const s of seances as any[]) {
    const diff = Math.round(
      (new Date().getTime() - new Date(s.date + "T00:00:00").getTime())
      / (1000 * 60 * 60 * 24)
    );
    if (diff === streak || diff === streak + 1) {
      streak++;
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
