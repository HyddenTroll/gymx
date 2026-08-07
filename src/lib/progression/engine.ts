import type { Cran, Niveau, ExerciceConfig, ProgressionResult } from "@/types";

function incrementFromRPE(rpe: number, niveau: Niveau): number {
  if (niveau === "debutant") {
    return 3.5 - (rpe - 1) * 0.4;
  }
  return 3 - (rpe - 1) * 0.5;
}

function applySens(increment: number, sens: "normal" | "inverse"): number {
  return sens === "inverse" ? -increment : increment;
}

function rpeToSimpleCran(rpe: number): Cran {
  if (rpe <= 3) return "facile";
  if (rpe <= 6) return "ca_passe";
  if (rpe <= 8) return "dur";
  if (rpe === 9) return "a_la_limite";
  return "impossible";
}

// Ancienne fonction pour les crans discrets (conservée pour tests)
function getIncrementForLevel(cran: Cran, niveau: Niveau): number {
  if (niveau === "debutant") {
    switch (cran) {
      case "facile": return 2;
      case "ca_passe": return 2;
      case "dur": return 1;
      case "a_la_limite": return 0;
      case "impossible": return -2;
    }
  }
  switch (cran) {
    case "facile": return 2;
    case "ca_passe": return 1;
    case "dur": return 0;
    case "a_la_limite": return 0;
    case "impossible": return -2;
  }
}

// Nouvelle fonction : RPE continu 1-10 avec incrément adaptatif
export function calculerProgressionRPE(
  rpe: number,
  niveau: Niveau,
  config: ExerciceConfig,
  charge_actuelle: number,
  historique_rpe?: number[]
): ProgressionResult & { deload_suggere: boolean; plateau_detecte: boolean } {
  const rpeClamp = Math.max(1, Math.min(10, rpe));
  const cran = rpeToSimpleCran(rpeClamp);

  let raw = incrementFromRPE(rpeClamp, niveau);

  // Incrément adaptatif : ajuste selon l'historique RPE
  if (historique_rpe && historique_rpe.length >= 2) {
    const recentAvg = historique_rpe.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, historique_rpe.length);
    if (recentAvg <= 4) raw *= 1.5; // Facile répété → doubler l'incrément
    else if (recentAvg >= 9) raw *= 0.5; // Trop dur répété → diviser l'incrément
  }

  // Détection plateau : si RPE monte sans que la charge augmente
  let plateau_detecte = false;
  if (historique_rpe && historique_rpe.length >= 3) {
    const troisDerniers = historique_rpe.slice(-3);
    if (troisDerniers[2] >= troisDerniers[0] + 2 && charge_actuelle > 0) {
      plateau_detecte = true;
    }
  }

  // Détection deload suggéré : RPE ≥ 9 sur les 2 dernières séances
  let deload_suggere = false;
  if (historique_rpe && historique_rpe.length >= 2) {
    const deuxDerniers = historique_rpe.slice(-2);
    if (deuxDerniers.every((r) => r >= 9)) deload_suggere = true;
  }

  const adjusted = applySens(raw, config.sens);
  let nouveau_compteur = config.compteur_echecs;

  if (rpeClamp >= 9) nouveau_compteur += 1;
  else if (rpeClamp <= 4) nouveau_compteur = 0;

  const deload_force = nouveau_compteur >= 2 || deload_suggere;

  if (rpeClamp >= 9) {
    return {
      increment_count: Math.round(adjusted) || 0,
      deload: true,
      deload_suggere: true,
      plateau_detecte,
      nouvelle_charge: Math.max(0, charge_actuelle + Math.round(adjusted) * config.pas),
      nouveau_compteur_echecs: nouveau_compteur,
    };
  }

  const incRound = Math.round(adjusted) || 0;
  const nouvelle_charge = Math.max(0, charge_actuelle + incRound * config.pas);

  return {
    increment_count: incRound,
    deload: deload_force,
    deload_suggere,
    plateau_detecte,
    nouvelle_charge,
    nouveau_compteur_echecs: nouveau_compteur,
  };
}

// Ancienne fonction conservée pour backward compat (appels existants + tests)
export function calculerProgression(
  cran: Cran,
  niveau: Niveau,
  config: ExerciceConfig,
  charge_actuelle: number
): ProgressionResult {
  const rpeMap: Record<Cran, number> = { facile: 4, ca_passe: 6, dur: 8, a_la_limite: 9, impossible: 10 };
  const result = calculerProgressionRPE(rpeMap[cran], niveau, config, charge_actuelle);
  return {
    increment_count: result.increment_count,
    deload: result.deload,
    nouvelle_charge: result.nouvelle_charge,
    nouveau_compteur_echecs: result.nouveau_compteur_echecs,
  };
}
