import type { Cran, Niveau, ExerciceConfig, ProgressionResult } from "@/types";

function getIncrementForLevel(cran: Cran, niveau: Niveau): number {
  if (niveau === "debutant") {
    switch (cran) {
      case "facile":
        return 2;
      case "ca_passe":
        return 2;
      case "dur":
        return 1;
      case "a_la_limite":
        return 0;
      case "impossible":
        return -2;
    }
  }

  switch (cran) {
    case "facile":
      return 2;
    case "ca_passe":
      return 1;
    case "dur":
      return 0;
    case "a_la_limite":
      return 0;
    case "impossible":
      return -2;
  }
}

function applySens(increment: number, sens: "normal" | "inverse"): number {
  return sens === "inverse" ? -increment : increment;
}

export function calculerProgression(
  cran: Cran,
  niveau: Niveau,
  config: ExerciceConfig,
  charge_actuelle: number
): ProgressionResult {
  const raw = getIncrementForLevel(cran, niveau);
  const adjusted = applySens(raw, config.sens);
  let nouveau_compteur = config.compteur_echecs;

  if (cran === "impossible") {
    nouveau_compteur += 1;
  } else if (cran === "facile" || cran === "ca_passe") {
    nouveau_compteur = 0;
  }

  const devrait_deload = nouveau_compteur >= 2;

  if (cran === "impossible") {
    return {
      increment_count: adjusted,
      deload: true,
      nouvelle_charge: Math.max(0, charge_actuelle + adjusted * config.pas),
      nouveau_compteur_echecs: nouveau_compteur,
    };
  }

  if (cran === "facile" && config.sens === "inverse") {
    return {
      increment_count: adjusted,
      deload: false,
      nouvelle_charge: Math.max(0, charge_actuelle + adjusted * config.pas),
      nouveau_compteur_echecs: nouveau_compteur,
    };
  }

  const nouvelle_charge = Math.max(0, charge_actuelle + adjusted * config.pas);

  return {
    increment_count: adjusted,
    deload: devrait_deload,
    nouvelle_charge,
    nouveau_compteur_echecs: nouveau_compteur,
  };
}
