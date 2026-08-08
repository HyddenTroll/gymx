import { createClient } from "@/lib/supabase/client";
import type { Exercice } from "@/types";

/**
 * Rotation des accessoires : remplace un exo accessoire par un autre
 * du même pool de sous-région, en évitant le dernier utilisé.
 * Les exos "principal" restent fixes.
 */
export async function faireRotation(
  programmeStructureId: string,
  exerciceActuelId: string,
  sousRegion: string,
  fige: boolean,
  force?: boolean
): Promise<string | null> {
  if (fige && !force) return null;

  const supabase = createClient();

  const { data: pool } = await supabase
    .from("pools_substitution")
    .select("exercice_id")
    .eq("sous_region", sousRegion)
    .order("ordre");

  if (!pool || pool.length <= 1) return null;

  const { data: { user } } = await supabase.auth.getUser();
  let exclusSet = new Set<string>();
  if (user) {
    const { data: exclus } = await supabase
      .from("exercices_exclus")
      .select("exercice_id")
      .eq("user_id", user.id);
    exclusSet = new Set((exclus || []).map((e: any) => e.exercice_id));
  }

  const ids = pool.map((p: any) => p.exercice_id);
  const autres = ids.filter((id: string) => id !== exerciceActuelId && !exclusSet.has(id));

  if (autres.length === 0) return null;

  const nextId = autres[Math.floor(Math.random() * autres.length)];

  await supabase
    .from("programme_structure")
    .update({ exercice_id: nextId })
    .eq("id", programmeStructureId);

  return nextId;
}

/**
 * Récupère les exercices d'une séance de programme avec rotation appliquée.
 * Remplace chaque accessoire par un exo aléatoire de son pool.
 */
export async function getExercicesSeance(
  programmeActifId: string,
  jour: number
): Promise<{ structure_id: string; exercice: Exercice; series: number; reps: number; role: string; fige: boolean }[]> {
  const supabase = createClient();

  const { data: structures } = await supabase
    .from("programme_structure")
    .select(`
      id, exercice_id, ordre, series_cibles, reps_cibles, role, fige,
      exercice:exercice_id(*)
    `)
    .eq("programme_actif_id", programmeActifId)
    .eq("jour", jour)
    .order("ordre");

  if (!structures) return [];

  return structures.map((s: any) => ({
    structure_id: s.id,
    exercice: s.exercice as Exercice,
    series: s.series_cibles,
    reps: s.reps_cibles,
    role: s.role,
    fige: s.fige,
  }));
}
