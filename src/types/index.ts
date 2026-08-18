export type Cran = "facile" | "ca_passe" | "dur" | "a_la_limite" | "impossible";

export type Niveau = "debutant" | "intermediaire" | "avance";

export type Unite = "kg" | "plaque" | "unite" | "reps";

export type Sens = "normal" | "inverse";

export type Objectif = "force" | "muscle" | "recomposition";

export type Materiel = "salle" | "halteres" | "corps";

export type GroupeMuscle =
  | "pectoraux"
  | "epaules"
  | "dos"
  | "quadriceps"
  | "ischios_fessiers"
  | "biceps"
  | "triceps"
  | "mollets"
  | "abdos";

export type SousRegion =
  | "pecs_haut"
  | "pecs_milieu_bas"
  | "epaules_anterieur"
  | "epaules_lateral"
  | "epaules_posterieur"
  | "dos_largeur"
  | "dos_epaisseur"
  | "trapezes"
  | "ischios_hanche"
  | "ischios_flexion"
  | "quads_squat"
  | "quads_isolation"
  | "biceps"
  | "triceps"
  | "mollets"
  | "abdos";

export type Role = "principal" | "accessoire";

export interface ExerciceConfig {
  unite: Unite;
  pas: number;
  sens: Sens;
  compteur_echecs: number;
}

export interface ProgressionResult {
  increment_count: number;
  deload: boolean;
  nouvelle_charge: number;
  nouveau_compteur_echecs: number;
  deload_suggere?: boolean;
  plateau_detecte?: boolean;
}

export interface Profil {
  niveau: Niveau;
  jours_par_semaine: 3 | 4 | 5 | 6;
  objectif: Objectif;
  materiel: Materiel;
}

export interface Exercice {
  id: string;
  nom_fr: string;
  groupe: GroupeMuscle;
  sous_region: SousRegion;
  equipement: Materiel;
  compound: boolean;
  role: Role;
  assist_inverse: boolean;
  unite_par_defaut: Unite;
  pas_par_defaut: number;
  image_url: string | null;
}

export interface ProgrammeTemplate {
  id: string;
  nom: string;
  description: string;
  duree_semaines: number;
  jours_par_semaine: number;
  niveau_min: Niveau;
  objectifs: Objectif[];
  materiel: Materiel[];
  score: number;
}
