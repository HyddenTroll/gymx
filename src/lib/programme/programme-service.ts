import { createClient } from "@/lib/supabase/client";
import { PROGRAMMES_TEMPLATES, scorerProgramme, type ProgrammeTemplate } from "./templates";
import type { Niveau, Objectif, Materiel } from "@/types";

export function trouverMeilleurProgramme(
  niveau: Niveau,
  objectif: Objectif,
  jours: number,
  materiel: Materiel
): ProgrammeTemplate | null {
  const scores = PROGRAMMES_TEMPLATES.map((p) => ({
    prog: p,
    score: scorerProgramme(p, niveau, objectif, jours, materiel),
  }));

  scores.sort((a, b) => b.score - a.score);

  if (scores.length > 0 && scores[0].score > 20) {
    return scores[0].prog;
  }

  return null;
}

export async function creerProgramme(
  userId: string,
  template: ProgrammeTemplate
): Promise<boolean> {
  const supabase = createClient();

  const { data: prog, error: progError } = await supabase
    .from("programme_actif")
    .insert({
      user_id: userId,
      nom: template.nom,
      type_programme: "template",
      date_debut: new Date().toISOString().split("T")[0],
      semaine_courante: 1,
      cycle_courant: 1,
      longueur_bloc: template.duree_semaines,
      jours_par_semaine: template.jours_par_semaine,
    })
    .select("id")
    .single();

  if (progError || !prog) return false;

  for (const jourData of template.structure) {
    for (let ordre = 0; ordre < jourData.exercices.length; ordre++) {
      const ex = jourData.exercices[ordre];

      const { data: exo } = await supabase
        .from("exercices")
        .select("id, unite_par_defaut, pas_par_defaut, assist_inverse")
        .eq("slug", ex.slug)
        .maybeSingle();

      if (!exo) continue;

      await supabase.from("programme_structure").insert({
        programme_actif_id: prog.id,
        jour: jourData.jour,
        exercice_id: exo.id,
        ordre,
        series_cibles: ex.series,
        reps_cibles: ex.reps,
        role: ex.role,
        fige: ex.role === "principal",
      });

      const { data: existingCharge } = await supabase
        .from("charges")
        .select("id")
        .eq("user_id", userId)
        .eq("exercice_id", exo.id)
        .maybeSingle();

      if (!existingCharge) {
        await supabase.from("charges").insert({
          user_id: userId,
          exercice_id: exo.id,
          charge_actuelle: 0,
          unite: exo.unite_par_defaut,
          pas: exo.pas_par_defaut,
          sens: exo.assist_inverse ? "inverse" : "normal",
          compteur_echecs: 0,
        });
      }
    }
  }

  return true;
}
