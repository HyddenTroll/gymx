import type { Niveau, Objectif, Materiel } from "@/types";

export interface ProgrammeTemplate {
  id: string;
  nom: string;
  description: string;
  duree_semaines: number;
  jours_par_semaine: number;
  niveau_min: Niveau;
  objectifs: Objectif[];
  materiel: Materiel[];
  structure: {
    jour: number;
    exercices: { slug: string; series: number; reps: number; role: "principal" | "accessoire" }[];
  }[];
}

export const PROGRAMMES_TEMPLATES: ProgrammeTemplate[] = [
  {
    id: "starting-strength",
    nom: "Starting Strength",
    description: "Programme débutant 3×5, 3 jours/semaine. Squat, couché, SDT à chaque séance.",
    duree_semaines: 12,
    jours_par_semaine: 3,
    niveau_min: "debutant",
    objectifs: ["force"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 5, role: "principal" },
          { slug: "developpe_couche_barre", series: 3, reps: 5, role: "principal" },
          { slug: "souleve_de_terre", series: 1, reps: 5, role: "principal" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 5, role: "principal" },
          { slug: "developpe_militaire_barre", series: 3, reps: 5, role: "principal" },
          { slug: "rowing_barre", series: 3, reps: 5, role: "principal" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 5, role: "principal" },
          { slug: "developpe_couche_barre", series: 3, reps: 5, role: "principal" },
          { slug: "souleve_de_terre", series: 1, reps: 5, role: "principal" },
        ],
      },
    ],
  },
  {
    id: "stronglifts-5x5",
    nom: "StrongLifts 5×5",
    description: "5 séries de 5 reps, 3 jours/semaine. Progression linéaire simple.",
    duree_semaines: 12,
    jours_par_semaine: 3,
    niveau_min: "debutant",
    objectifs: ["force"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "squat_barre", series: 5, reps: 5, role: "principal" },
          { slug: "developpe_couche_barre", series: 5, reps: 5, role: "principal" },
          { slug: "rowing_barre", series: 5, reps: 5, role: "principal" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "squat_barre", series: 5, reps: 5, role: "principal" },
          { slug: "developpe_militaire_barre", series: 5, reps: 5, role: "principal" },
          { slug: "souleve_de_terre", series: 1, reps: 5, role: "principal" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "squat_barre", series: 5, reps: 5, role: "principal" },
          { slug: "developpe_couche_barre", series: 5, reps: 5, role: "principal" },
          { slug: "rowing_barre", series: 5, reps: 5, role: "principal" },
        ],
      },
    ],
  },
  {
    id: "full-body-muscle",
    nom: "Full Body Prise de muscle",
    description: "Full body 3×/semaine, volume modéré pour l'hypertrophie.",
    duree_semaines: 8,
    jours_par_semaine: 3,
    niveau_min: "debutant",
    objectifs: ["muscle", "recomposition"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 8, role: "principal" },
          { slug: "developpe_couche_barre", series: 3, reps: 8, role: "principal" },
          { slug: "rowing_barre", series: 3, reps: 8, role: "principal" },
          { slug: "developpe_militaire_barre", series: 3, reps: 10, role: "accessoire" },
          { slug: "curl_barre", series: 3, reps: 12, role: "accessoire" },
          { slug: "extension_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "souleve_de_terre_roumain", series: 3, reps: 8, role: "principal" },
          { slug: "developpe_incline_barre", series: 3, reps: 8, role: "principal" },
          { slug: "tirage_vertical_a_la_poulie", series: 3, reps: 8, role: "principal" },
          { slug: "elevations_laterales_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "curl_marteau", series: 3, reps: 12, role: "accessoire" },
          { slug: "barre_au_front", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "presse_a_cuisses", series: 3, reps: 8, role: "principal" },
          { slug: "developpe_militaire_barre", series: 3, reps: 8, role: "principal" },
          { slug: "rowing_haltere", series: 3, reps: 8, role: "principal" },
          { slug: "ecarte_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "oiseau_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "curl_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
        ],
      },
    ],
  },
  {
    id: "gzclp",
    nom: "GZCLP",
    description: "Progression linéaire 4 jours, heavy/light. Idéal intermédiaire.",
    duree_semaines: 12,
    jours_par_semaine: 4,
    niveau_min: "intermediaire",
    objectifs: ["force", "muscle"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "squat_barre", series: 5, reps: 3, role: "principal" },
          { slug: "developpe_couche_barre", series: 3, reps: 10, role: "principal" },
          { slug: "rowing_barre", series: 3, reps: 15, role: "accessoire" },
          { slug: "curl_barre", series: 3, reps: 15, role: "accessoire" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "developpe_militaire_barre", series: 5, reps: 3, role: "principal" },
          { slug: "souleve_de_terre", series: 3, reps: 10, role: "principal" },
          { slug: "tirage_vertical_a_la_poulie", series: 3, reps: 15, role: "accessoire" },
          { slug: "extension_a_la_poulie", series: 3, reps: 15, role: "accessoire" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 10, role: "principal" },
          { slug: "developpe_couche_barre", series: 5, reps: 3, role: "principal" },
          { slug: "rowing_haltere", series: 3, reps: 15, role: "accessoire" },
          { slug: "curl_marteau", series: 3, reps: 15, role: "accessoire" },
        ],
      },
      {
        jour: 4,
        exercices: [
          { slug: "developpe_militaire_barre", series: 3, reps: 10, role: "principal" },
          { slug: "souleve_de_terre_roumain", series: 3, reps: 10, role: "principal" },
          { slug: "tirage_horizontal_a_la_poulie", series: 3, reps: 15, role: "accessoire" },
          { slug: "barre_au_front", series: 3, reps: 15, role: "accessoire" },
        ],
      },
    ],
  },
  {
    id: "phul",
    nom: "PHUL",
    description: "Power Hypertrophy Upper Lower. 4 jours : force + volume.",
    duree_semaines: 8,
    jours_par_semaine: 4,
    niveau_min: "intermediaire",
    objectifs: ["force", "muscle"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "squat_barre", series: 4, reps: 5, role: "principal" },
          { slug: "developpe_couche_barre", series: 4, reps: 5, role: "principal" },
          { slug: "rowing_barre", series: 4, reps: 5, role: "principal" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "developpe_militaire_barre", series: 3, reps: 8, role: "principal" },
          { slug: "souleve_de_terre", series: 3, reps: 5, role: "principal" },
          { slug: "tractions", series: 3, reps: 8, role: "principal" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "presse_a_cuisses", series: 3, reps: 10, role: "principal" },
          { slug: "leg_extension", series: 3, reps: 12, role: "accessoire" },
          { slug: "leg_curl_allonge", series: 3, reps: 12, role: "accessoire" },
          { slug: "developpe_incline_barre", series: 3, reps: 10, role: "principal" },
          { slug: "ecarte_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 4,
        exercices: [
          { slug: "tirage_vertical_a_la_poulie", series: 3, reps: 12, role: "principal" },
          { slug: "rowing_haltere", series: 3, reps: 12, role: "principal" },
          { slug: "elevations_laterales_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "oiseau_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "curl_barre", series: 3, reps: 12, role: "accessoire" },
          { slug: "extension_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
        ],
      },
    ],
  },
  {
    id: "ppl",
    nom: "Push Pull Legs",
    description: "Split 6 jours : Push, Pull, Legs. Le standard Reddit.",
    duree_semaines: 8,
    jours_par_semaine: 6,
    niveau_min: "intermediaire",
    objectifs: ["muscle", "force"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "developpe_couche_barre", series: 4, reps: 5, role: "principal" },
          { slug: "developpe_incline_barre", series: 3, reps: 8, role: "principal" },
          { slug: "developpe_militaire_barre", series: 3, reps: 8, role: "principal" },
          { slug: "elevations_laterales_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "extension_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
          { slug: "barre_au_front", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "souleve_de_terre", series: 1, reps: 5, role: "principal" },
          { slug: "rowing_barre", series: 4, reps: 8, role: "principal" },
          { slug: "tirage_vertical_a_la_poulie", series: 3, reps: 10, role: "principal" },
          { slug: "tirage_horizontal_a_la_poulie", series: 3, reps: 10, role: "accessoire" },
          { slug: "curl_barre", series: 3, reps: 12, role: "accessoire" },
          { slug: "curl_marteau", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "squat_barre", series: 4, reps: 5, role: "principal" },
          { slug: "presse_a_cuisses", series: 3, reps: 10, role: "principal" },
          { slug: "souleve_de_terre_roumain", series: 3, reps: 10, role: "principal" },
          { slug: "leg_extension", series: 3, reps: 12, role: "accessoire" },
          { slug: "leg_curl_allonge", series: 3, reps: 12, role: "accessoire" },
          { slug: "mollets_debout_machine", series: 4, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 4,
        exercices: [
          { slug: "developpe_couche_barre", series: 4, reps: 8, role: "principal" },
          { slug: "developpe_incline_halteres", series: 3, reps: 10, role: "principal" },
          { slug: "ecarte_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
          { slug: "elevations_laterales_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
          { slug: "face_pull", series: 3, reps: 12, role: "accessoire" },
          { slug: "extension_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 5,
        exercices: [
          { slug: "souleve_de_terre_roumain", series: 3, reps: 8, role: "principal" },
          { slug: "rowing_haltere", series: 4, reps: 8, role: "principal" },
          { slug: "tirage_vertical_a_la_poulie", series: 3, reps: 10, role: "principal" },
          { slug: "shrugs_barre", series: 3, reps: 12, role: "accessoire" },
          { slug: "face_pull", series: 3, reps: 12, role: "accessoire" },
          { slug: "curl_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 6,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 8, role: "principal" },
          { slug: "fentes_halteres", series: 3, reps: 10, role: "principal" },
          { slug: "leg_extension", series: 3, reps: 12, role: "accessoire" },
          { slug: "leg_curl_allonge", series: 3, reps: 12, role: "accessoire" },
          { slug: "mollets_assis", series: 4, reps: 12, role: "accessoire" },
        ],
      },
    ],
  },
  {
    id: "phat",
    nom: "PHAT",
    description: "Power Hypertrophy Adaptive Training. 5 jours, volume élevé.",
    duree_semaines: 8,
    jours_par_semaine: 5,
    niveau_min: "avance",
    objectifs: ["force", "muscle"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 5, role: "principal" },
          { slug: "developpe_couche_barre", series: 3, reps: 5, role: "principal" },
          { slug: "rowing_barre", series: 3, reps: 5, role: "principal" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "developpe_militaire_barre", series: 3, reps: 5, role: "principal" },
          { slug: "souleve_de_terre", series: 3, reps: 5, role: "principal" },
          { slug: "tractions", series: 3, reps: 5, role: "principal" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "developpe_incline_halteres", series: 3, reps: 8, role: "principal" },
          { slug: "ecarte_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "elevations_laterales_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "oiseau_halteres", series: 3, reps: 12, role: "accessoire" },
          { slug: "extension_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
          { slug: "curl_barre", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 4,
        exercices: [
          { slug: "presse_a_cuisses", series: 3, reps: 10, role: "principal" },
          { slug: "leg_extension", series: 3, reps: 12, role: "accessoire" },
          { slug: "souleve_de_terre_roumain", series: 3, reps: 10, role: "principal" },
          { slug: "leg_curl_allonge", series: 3, reps: 12, role: "accessoire" },
          { slug: "mollets_debout_machine", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 5,
        exercices: [
          { slug: "tirage_vertical_a_la_poulie", series: 3, reps: 10, role: "principal" },
          { slug: "rowing_haltere", series: 3, reps: 10, role: "principal" },
          { slug: "tirage_horizontal_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
          { slug: "curl_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
          { slug: "extension_a_la_poulie", series: 3, reps: 12, role: "accessoire" },
          { slug: "face_pull", series: 3, reps: 12, role: "accessoire" },
        ],
      },
    ],
  },
  {
    id: "531-bbb",
    nom: "5/3/1 Boring But Big",
    description: "Cycle 5/3/1 + BBB. 4 jours, force + volume accessoire.",
    duree_semaines: 4,
    jours_par_semaine: 4,
    niveau_min: "intermediaire",
    objectifs: ["force", "muscle"],
    materiel: ["salle"],
    structure: [
      {
        jour: 1,
        exercices: [
          { slug: "squat_barre", series: 3, reps: 5, role: "principal" },
          { slug: "presse_a_cuisses", series: 5, reps: 10, role: "principal" },
          { slug: "leg_curl_allonge", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 2,
        exercices: [
          { slug: "developpe_couche_barre", series: 3, reps: 5, role: "principal" },
          { slug: "developpe_couche_barre", series: 5, reps: 10, role: "principal" },
          { slug: "rowing_barre", series: 3, reps: 10, role: "accessoire" },
        ],
      },
      {
        jour: 3,
        exercices: [
          { slug: "developpe_militaire_barre", series: 3, reps: 5, role: "principal" },
          { slug: "developpe_militaire_barre", series: 5, reps: 10, role: "principal" },
          { slug: "elevations_laterales_halteres", series: 3, reps: 12, role: "accessoire" },
        ],
      },
      {
        jour: 4,
        exercices: [
          { slug: "souleve_de_terre", series: 3, reps: 5, role: "principal" },
          { slug: "souleve_de_terre_roumain", series: 5, reps: 10, role: "principal" },
          { slug: "tirage_vertical_a_la_poulie", series: 3, reps: 10, role: "accessoire" },
        ],
      },
    ],
  },
];

export function scorerProgramme(
  prog: ProgrammeTemplate,
  niveau: Niveau,
  objectif: Objectif,
  jours: number,
  materiel: Materiel
): number {
  let score = 0;

  if (prog.jours_par_semaine === jours) score += 30;
  else if (Math.abs(prog.jours_par_semaine - jours) === 1) score += 10;

  if (prog.objectifs.includes(objectif)) score += 25;
  else score += 5;

  const niveauxOrdre: Record<Niveau, number> = { debutant: 0, intermediaire: 1, avance: 2 };
  const progNiveau = niveauxOrdre[prog.niveau_min] ?? 0;
  const userNiveau = niveauxOrdre[niveau];
  if (progNiveau <= userNiveau) score += 20;
  else score += 5;

  if (prog.materiel.includes(materiel)) score += 15;
  else if (materiel === "corps" && prog.materiel.includes("corps")) score += 15;
  else score += 5;

  if (prog.niveau_min === niveau) score += 10;

  return score;
}
