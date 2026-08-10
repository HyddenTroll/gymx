import type { Niveau, GroupeMuscle } from "@/types";

/**
 * Repères de volume hebdomadaire (sets/semaine) par groupe musculaire
 * Sources :
 * - Israetel, M. (Renaissance Periodization) — framework MEV/MAV/MRV
 * - Pelland et al. (2025) — meta-analyse 67 études, Sports Medicine
 * - Schoenfeld et al. (2017) — dose-response, 15 études, 296 sujets
 * - Frontiers in Sports and Active Living (2025) — quantification volume
 * - PoinT GO Sports Science Lab (2026) — per-muscle reference table
 */

export interface VolumeLandmarks {
  mev: number;  // Minimum Effective Volume
  mav_min: number; // Maximum Adaptive Volume (bas)
  mav_max: number; // Maximum Adaptive Volume (haut)
  mrv: number; // Maximum Recoverable Volume
}

const INTERMEDIAIRE_BASE: Record<GroupeMuscle, VolumeLandmarks> = {
  pectoraux:   { mev: 8,  mav_min: 12, mav_max: 16, mrv: 20 },
  epaules:     { mev: 6,  mav_min: 10, mav_max: 14, mrv: 18 },
  dos:         { mev: 8,  mav_min: 12, mav_max: 18, mrv: 22 },
  quadriceps:  { mev: 8,  mav_min: 12, mav_max: 18, mrv: 22 },
  ischios_fessiers: { mev: 6, mav_min: 10, mav_max: 14, mrv: 18 },
  biceps:      { mev: 6,  mav_min: 10, mav_max: 14, mrv: 18 },
  triceps:     { mev: 6,  mav_min: 10, mav_max: 14, mrv: 18 },
  mollets:     { mev: 4,  mav_min: 8,  mav_max: 12, mrv: 16 },
  abdos:       { mev: 4,  mav_min: 8,  mav_max: 12, mrv: 16 },
};

const DEBUTANT: Record<GroupeMuscle, VolumeLandmarks> = {
  pectoraux:   { mev: 6,  mav_min: 8,  mav_max: 12, mrv: 16 },
  epaules:     { mev: 4,  mav_min: 8,  mav_max: 10, mrv: 14 },
  dos:         { mev: 6,  mav_min: 8,  mav_max: 14, mrv: 18 },
  quadriceps:  { mev: 6,  mav_min: 8,  mav_max: 14, mrv: 18 },
  ischios_fessiers: { mev: 4, mav_min: 8,  mav_max: 10, mrv: 14 },
  biceps:      { mev: 4,  mav_min: 8,  mav_max: 10, mrv: 14 },
  triceps:     { mev: 4,  mav_min: 8,  mav_max: 10, mrv: 14 },
  mollets:     { mev: 3,  mav_min: 6,  mav_max: 8,  mrv: 12 },
  abdos:       { mev: 3,  mav_min: 6,  mav_max: 8,  mrv: 12 },
};

const AVANCE: Record<GroupeMuscle, VolumeLandmarks> = {
  pectoraux:   { mev: 10, mav_min: 14, mav_max: 20, mrv: 24 },
  epaules:     { mev: 8,  mav_min: 12, mav_max: 16, mrv: 20 },
  dos:         { mev: 10, mav_min: 14, mav_max: 22, mrv: 26 },
  quadriceps:  { mev: 10, mav_min: 14, mav_max: 22, mrv: 26 },
  ischios_fessiers: { mev: 8, mav_min: 12, mav_max: 16, mrv: 20 },
  biceps:      { mev: 8,  mav_min: 12, mav_max: 16, mrv: 20 },
  triceps:     { mev: 8,  mav_min: 12, mav_max: 16, mrv: 20 },
  mollets:     { mev: 6,  mav_min: 10, mav_max: 14, mrv: 18 },
  abdos:       { mev: 6,  mav_min: 10, mav_max: 14, mrv: 18 },
};

export function getVolumeLandmarks(groupe: GroupeMuscle, niveau: Niveau): VolumeLandmarks {
  if (niveau === "debutant") return DEBUTANT[groupe];
  if (niveau === "intermediaire") return INTERMEDIAIRE_BASE[groupe];
  return AVANCE[groupe];
}

export function getVolumeStatus(
  sets: number,
  groupe: GroupeMuscle,
  niveau: Niveau
): "trop_peu" | "mev" | "mav" | "proche_mrv" | "trop" {
  const { mev, mav_min, mav_max, mrv } = getVolumeLandmarks(groupe, niveau);
  if (sets < mev) return "trop_peu";
  if (sets < mav_min) return "mev";
  if (sets <= mav_max) return "mav";
  if (sets <= mrv) return "proche_mrv";
  return "trop";
}

export function getVolumeRangeLabel(groupe: GroupeMuscle, niveau: Niveau): string {
  const { mev, mav_min, mav_max, mrv } = getVolumeLandmarks(groupe, niveau);
  return `MEV ${mev} · MAV ${mav_min}-${mav_max} · MRV ${mrv}`;
}
