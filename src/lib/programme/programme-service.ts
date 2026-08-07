import { createClient } from "@/lib/supabase/client";
import { PROGRAMMES_TEMPLATES, type ProgrammeTemplate } from "./templates";
import type { Niveau, Objectif, Materiel } from "@/types";

const niveauOrdre: Record<Niveau, number> = { debutant: 0, intermediaire: 1, avance: 2 };

interface ProfilComplet {
  niveau: Niveau;
  jours: number;
  objectif: Objectif;
  materiel: Materiel;
}

function estEligible(prog: ProgrammeTemplate, profil: ProfilComplet): { ok: boolean; raison?: string } {
  const userNiveau = niveauOrdre[profil.niveau];
  const minNiveau = niveauOrdre[prog.niveau_min];
  const maxNiveau = niveauOrdre[prog.niveau_max];

  if (userNiveau < minNiveau) {
    return { ok: false, raison: `Niveau insuffisant. Ce programme demande un niveau ${prog.niveau_min}.` };
  }
  if (userNiveau > maxNiveau) {
    return { ok: false, raison: `Ce programme est conçu pour les niveaux jusqu'à ${prog.niveau_max}. Tu es plus avancé.` };
  }

  if (!prog.materiel.includes(profil.materiel)) {
    if (profil.materiel === "corps") {
      return { ok: false, raison: "Ce programme nécessite un accès à une salle ou des haltères." };
    }
    if (profil.materiel === "halteres" && !prog.materiel.includes("halteres")) {
      return { ok: false, raison: "Ce programme utilise des barres et machines non disponibles avec juste des haltères." };
    }
  }

  return { ok: true };
}

function scorerProgramme(prog: ProgrammeTemplate, profil: ProfilComplet): number {
  let score = 0;

  const userNiveau = niveauOrdre[profil.niveau];
  const minNiveau = niveauOrdre[prog.niveau_min];
  const idealNiveau = (minNiveau + niveauOrdre[prog.niveau_max]) / 2;
  const ecartNiveau = Math.abs(userNiveau - idealNiveau);
  score += Math.max(0, 30 - ecartNiveau * 15);

  const ecartJours = Math.abs(prog.jours_par_semaine - profil.jours);
  if (ecartJours === 0) score += 30;
  else if (ecartJours === 1) score += 15;
  else if (ecartJours === 2) score += 5;

  if (prog.objectifs.includes(profil.objectif)) {
    score += 25;
    if (profil.objectif === "force" && prog.tags.includes("force")) score += 10;
    if (profil.objectif === "muscle" && prog.tags.includes("hypertrophie")) score += 10;
  } else if (prog.objectifs.some((o) => o !== profil.objectif)) {
    const compat: Record<string, string[]> = { force: ["muscle"], muscle: ["force", "recomposition"], recomposition: ["muscle"] };
    if (compat[profil.objectif]?.some((c) => prog.objectifs.includes(c as any))) {
      score += 10;
    }
  }

  if (prog.materiel.includes(profil.materiel)) score += 15;
  if (profil.materiel === "halteres" && prog.materiel.includes("halteres")) score += 5;

  score += prog.popularite;

  if (profil.niveau === "debutant" && (prog.id === "starting-strength" || prog.id === "stronglifts-5x5")) score += 15;
  if (profil.niveau === "intermediaire" && (prog.id === "gzclp" || prog.id === "phul")) score += 10;
  if (profil.objectif === "muscle" && profil.jours >= 5 && prog.id === "ppl") score += 15;
  if (profil.niveau === "avance" && prog.id === "phat") score += 10;

  if (profil.jours >= prog.jours_par_semaine) score += 5;

  return score;
}

export interface Recommandation {
  programme: ProgrammeTemplate;
  score: number;
  eligible: boolean;
  raison_ineligible?: string;
  match_pct: number;
}

export function recommanderProgrammes(profil: ProfilComplet): Recommandation[] {
  const scores = PROGRAMMES_TEMPLATES.map((prog) => {
    const elig = estEligible(prog, profil);
    const score = elig.ok ? scorerProgramme(prog, profil) : 0;
    const maxPossible = 130;
    return {
      programme: prog,
      score,
      eligible: elig.ok,
      raison_ineligible: elig.raison,
      match_pct: elig.ok ? Math.round((score / maxPossible) * 100) : 0,
    };
  });

  scores.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.score - a.score;
  });

  return scores;
}

export function trouverMeilleurProgramme(
  niveau: Niveau,
  objectif: Objectif,
  jours: number,
  materiel: Materiel
): ProgrammeTemplate | null {
  const resultats = recommanderProgrammes({ niveau, jours, objectif, materiel });
  const elibles = resultats.filter((r) => r.eligible);
  return elibles.length > 0 ? elibles[0].programme : null;
}

export async function creerProgramme(
  userId: string,
  template: ProgrammeTemplate
): Promise<boolean> {
  const supabase = createClient();

  const { data: existing } = await supabase.from("programme_actif").select("id").eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase.from("programme_actif").delete().eq("id", existing.id);
    await supabase.from("programme_structure").delete().eq("programme_actif_id", existing.id);
  }

  const { data: prog, error: progError } = await supabase.from("programme_actif")
    .insert({
      user_id: userId, nom: template.nom, type_programme: "template",
      date_debut: new Date().toISOString().split("T")[0],
      semaine_courante: 1, cycle_courant: 1, longueur_bloc: template.duree_semaines,
      jours_par_semaine: template.jours_par_semaine,
    }).select("id").single();

  if (progError || !prog) { console.error("[creerProgramme]", progError); return false; }

  for (const jourData of template.structure) {
    for (let ordre = 0; ordre < jourData.exercices.length; ordre++) {
      const ex = jourData.exercices[ordre];
      const { data: exo } = await supabase.from("exercices").select("id, unite_par_defaut, pas_par_defaut, assist_inverse").eq("slug", ex.slug).maybeSingle();
      if (!exo) continue;
      await supabase.from("programme_structure").insert({
        programme_actif_id: prog.id, jour: jourData.jour, exercice_id: exo.id,
        ordre, series_cibles: ex.series, reps_cibles: ex.reps, role: ex.role, fige: ex.role === "principal",
      });
      const { data: existingCharge } = await supabase.from("charges").select("id").eq("user_id", userId).eq("exercice_id", exo.id).maybeSingle();
      if (!existingCharge) {
        await supabase.from("charges").insert({
          user_id: userId, exercice_id: exo.id, charge_actuelle: 0,
          unite: exo.unite_par_defaut, pas: exo.pas_par_defaut,
          sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0,
        });
      }
    }
  }

  return true;
}
