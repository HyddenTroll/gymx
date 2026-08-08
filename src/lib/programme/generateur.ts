import { createClient } from "@/lib/supabase/client";
import type { Niveau, Objectif, Materiel } from "@/types";

interface GenererParams {
  userId: string;
  niveau: Niveau;
  jours: number;
  objectif: Objectif;
  materiel: Materiel;
  exclus: string[];
}

const SPLITS: Record<number, { nom: string; jours: { nom: string; sous_regions: string[] }[] }> = {
  3: {
    nom: "Full Body",
    jours: [
      { nom: "Full Body A", sous_regions: ["quads_squat", "pecs_milieu_bas", "dos_epaisseur", "epaules_anterieur", "biceps", "triceps"] },
      { nom: "Full Body B", sous_regions: ["ischios_hanche", "pecs_haut", "dos_largeur", "epaules_lateral", "biceps", "triceps"] },
      { nom: "Full Body C", sous_regions: ["quads_squat", "pecs_milieu_bas", "dos_epaisseur", "epaules_posterieur", "biceps", "triceps"] },
    ],
  },
  4: {
    nom: "Haut/Bas",
    jours: [
      { nom: "Haut Force", sous_regions: ["pecs_milieu_bas", "dos_epaisseur", "epaules_anterieur", "triceps"] },
      { nom: "Bas Force", sous_regions: ["quads_squat", "ischios_hanche", "ischios_flexion", "abdos"] },
      { nom: "Haut Volume", sous_regions: ["pecs_haut", "dos_largeur", "epaules_lateral", "epaules_posterieur", "biceps"] },
      { nom: "Bas Volume", sous_regions: ["quads_isolation", "ischios_hanche", "ischios_flexion", "mollets"] },
    ],
  },
  5: {
    nom: "Mixte",
    jours: [
      { nom: "Pecs + Triceps", sous_regions: ["pecs_milieu_bas", "pecs_haut", "triceps"] },
      { nom: "Dos + Biceps", sous_regions: ["dos_largeur", "dos_epaisseur", "trapezes", "biceps"] },
      { nom: "Jambes", sous_regions: ["quads_squat", "ischios_hanche", "ischios_flexion", "quads_isolation", "mollets"] },
      { nom: "Épaules + Bras", sous_regions: ["epaules_anterieur", "epaules_lateral", "epaules_posterieur", "biceps", "triceps"] },
      { nom: "Dos + Abdos", sous_regions: ["dos_largeur", "dos_epaisseur", "abdos", "mollets"] },
    ],
  },
  6: {
    nom: "Push Pull Legs",
    jours: [
      { nom: "Push 1", sous_regions: ["pecs_milieu_bas", "epaules_anterieur", "triceps"] },
      { nom: "Pull 1", sous_regions: ["dos_largeur", "dos_epaisseur", "biceps"] },
      { nom: "Legs 1", sous_regions: ["quads_squat", "ischios_hanche", "mollets"] },
      { nom: "Push 2", sous_regions: ["pecs_haut", "epaules_lateral", "epaules_posterieur", "triceps"] },
      { nom: "Pull 2", sous_regions: ["dos_largeur", "dos_epaisseur", "trapezes", "biceps"] },
      { nom: "Legs 2", sous_regions: ["quads_isolation", "ischios_flexion", "ischios_hanche", "abdos", "mollets"] },
    ],
  },
};

export async function genererProgramme(params: GenererParams): Promise<boolean> {
  const supabase = createClient();

  const split = SPLITS[params.jours] || SPLITS[3];
  const { data: tousLesExos } = await supabase.from("exercices").select("*");

  if (!tousLesExos) return false;

  const exclusSet = new Set(params.exclus);
  const disponibles = tousLesExos.filter((e: any) => !exclusSet.has(e.id) && (e.equipement === params.materiel || e.equipement === "corps"));

  const volumeParSemaine = params.objectif === "force" ? 12 : params.objectif === "muscle" ? 16 : 14;
  const setsParJour = Math.round(volumeParSemaine / params.jours);

  const { data: existing } = await supabase.from("programme_actif").select("id").eq("user_id", params.userId).maybeSingle();
  if (existing) {
    await supabase.from("programme_actif").delete().eq("id", existing.id);
    await supabase.from("programme_structure").delete().eq("programme_actif_id", existing.id);
  }

  const duree = params.niveau === "debutant" ? 8 : 12;

  const { data: prog, error } = await supabase.from("programme_actif").insert({
    user_id: params.userId, nom: `${split.nom} (généré)`, type_programme: "genere",
    date_debut: new Date().toISOString().split("T")[0],
    semaine_courante: 1, cycle_courant: 1, longueur_bloc: duree,
    jours_par_semaine: params.jours,
  }).select("id").single();

  if (error || !prog) return false;

  for (let j = 0; j < split.jours.length; j++) {
    const jour = split.jours[j];
    let ordre = 0;

    for (const region of jour.sous_regions) {
      const exosRegion = disponibles.filter((e: any) => e.sous_region === region);
      if (exosRegion.length === 0) continue;

      const exo = exosRegion[0];
      const reps = params.objectif === "force" ? 5 : params.objectif === "muscle" ? 10 : 8;

      await supabase.from("programme_structure").insert({
        programme_actif_id: prog.id, jour: j + 1, exercice_id: exo.id,
        ordre, series_cibles: setsParJour, reps_cibles: reps,
        role: ordre === 0 ? "principal" : "accessoire", fige: ordre === 0,
      });

      const { data: existingCharge } = await supabase.from("charges").select("id")
        .eq("user_id", params.userId).eq("exercice_id", exo.id).maybeSingle();
      if (!existingCharge) {
        await supabase.from("charges").insert({
          user_id: params.userId, exercice_id: exo.id, charge_actuelle: 0,
          unite: exo.unite_par_defaut, pas: exo.pas_par_defaut,
          sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0,
        });
      }
      ordre++;
    }
  }

  return true;
}
