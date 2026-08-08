import { createClient } from "@/lib/supabase/client";
import type { Exercice } from "@/types";

/**
 * Rotation des accessoires : remplace un exo accessoire par un autre
 * du même pool de sous-région, en évitant le dernier utilisé.
 * Les exos "principal" restent fixes.
 */
const FALLBACK_EQUIPEMENT = ["salle", "halteres", "corps"];

export async function faireRotation(
  programmeStructureId: string,
  exerciceActuelId: string,
  sousRegion: string,
  fige: boolean,
  force?: boolean,
  groupe?: string
): Promise<string | null> {
  if (fige && !force) return null;

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: exclus } = await supabase
    .from("exercices_exclus")
    .select("exercice_id")
    .eq("user_id", user.id);
  const exclusSet = new Set((exclus || []).map((e: any) => e.exercice_id));

  const { data: pool } = await supabase
    .from("pools_substitution")
    .select("exercice_id")
    .eq("sous_region", sousRegion)
    .order("ordre");

  let ids = pool ? pool.map((p: any) => p.exercice_id) : [];
  let autres = ids.filter((id: string) => id !== exerciceActuelId && !exclusSet.has(id));

  if (autres.length === 0) {
    const { data: profil } = await supabase
      .from("profil")
      .select("materiel")
      .eq("user_id", user.id)
      .single();

    const equip = profil?.materiel || "salle";

    const { data: fallback } = await supabase
      .from("exercices")
      .select("id")
      .eq("sous_region", sousRegion)
      .eq("equipement", equip);

    ids = fallback ? fallback.map((f: any) => f.id) : [];
    autres = ids.filter((id: string) => id !== exerciceActuelId && !exclusSet.has(id));
  }

  if (autres.length === 0 && groupe) {
    for (const equip of FALLBACK_EQUIPEMENT) {
      const { data: fallbackGroupe } = await supabase
        .from("exercices")
        .select("id, equipement")
        .eq("groupe", groupe);
      ids = fallbackGroupe ? fallbackGroupe.filter((f: any) => f.equipement === equip).map((f: any) => f.id) : [];
      autres = ids.filter((id: string) => id !== exerciceActuelId && !exclusSet.has(id));
      if (autres.length > 0) break;
    }
  }

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
