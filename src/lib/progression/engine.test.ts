import { describe, it, expect } from "vitest";
import { calculerProgression, calculerProgressionRPE } from "./engine";
import type { Cran, Niveau, ExerciceConfig } from "@/types";

function config(
  overrides: Partial<ExerciceConfig> = {}
): ExerciceConfig {
  return {
    unite: "kg",
    pas: 2.5,
    sens: "normal",
    compteur_echecs: 0,
    ...overrides,
  };
}

describe("calculerProgression", () => {
  describe("intermediaire/avance — §5.2", () => {
    const niveau: Niveau = "intermediaire";

    it.each([
      ["facile", 2],
      ["ca_passe", 1],
      ["dur", 0],
      ["a_la_limite", -1],
      ["impossible", -1],
    ] as [Cran, number][])("%s → %d incréments", (cran, expected) => {
      const result = calculerProgression(cran, niveau, config(), 50);
      expect(result.increment_count).toBe(expected);
    });
  });

  describe("debutant — §5.3", () => {
    const niveau: Niveau = "debutant";

    it.each([
      ["facile", 2],
      ["ca_passe", 2],
      ["dur", 1],
      ["a_la_limite", 0],
      ["impossible", 0],
    ] as [Cran, number][])("%s → %d incréments", (cran, expected) => {
      const result = calculerProgression(cran, niveau, config(), 50);
      expect(result.increment_count).toBe(expected);
    });
  });

  describe("unités et pas — §5.4", () => {
    it("pas en kg (2.5 kg)", () => {
      const result = calculerProgression("facile", "intermediaire", config({ pas: 2.5 }), 50);
      expect(result.nouvelle_charge).toBe(55);
    });

    it("pas en plaques (1 plaque)", () => {
      const result = calculerProgression("facile", "intermediaire", config({ unite: "plaque", pas: 1 }), 10);
      expect(result.nouvelle_charge).toBe(12);
    });

    it("microcharge (0.5 kg)", () => {
      const result = calculerProgression("facile", "intermediaire", config({ pas: 0.5 }), 30);
      expect(result.nouvelle_charge).toBe(31);
    });
  });

  describe("progression en reps (poids du corps) — §5.5", () => {
    it("facile → +2 reps", () => {
      const result = calculerProgression("facile", "intermediaire", config({ unite: "reps", pas: 1 }), 8);
      expect(result.increment_count).toBe(2);
      expect(result.nouvelle_charge).toBe(10);
    });

    it("impossible → -1 rep", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ unite: "reps", pas: 1 }), 8);
      expect(result.nouvelle_charge).toBe(7);
    });
  });

  describe("sens inverse (assistance) — §5.5", () => {
    it("facile → réduit l'assistance (-1 pas)", () => {
      const result = calculerProgression("facile", "intermediaire", config({ sens: "inverse", pas: 2 }), 20);
      expect(result.increment_count).toBe(-1);
      expect(result.nouvelle_charge).toBe(18);
    });

    it("impossible → augmente l'assistance (+2 pas)", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ sens: "inverse", pas: 2 }), 20);
      expect(result.increment_count).toBe(2);
      expect(result.nouvelle_charge).toBe(24);
    });
  });

  describe("deload — §5.5 + §5.6", () => {
    it("premier impossible → pas de deload forcé, compteur = 1 (deload seulement si historique 2× RPE≥9)", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ compteur_echecs: 0 }), 50);
      expect(result.nouvelle_charge).toBe(47.5);
      expect(result.nouveau_compteur_echecs).toBe(1);
      expect(result.deload).toBe(false);
    });

    it("deuxième impossible consécutif → deload -1, compteur = 2", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ compteur_echecs: 1 }), 45);
      expect(result.nouvelle_charge).toBe(42.5);
      expect(result.nouveau_compteur_echecs).toBe(2);
    });

    it("facile reset le compteur à 0", () => {
      const result = calculerProgression("facile", "intermediaire", config({ compteur_echecs: 2 }), 40);
      expect(result.nouveau_compteur_echecs).toBe(0);
    });
  });

  describe("calculerProgressionRPE — continu 1-10", () => {
    it("RPE 1 → ~+3 incréments", () => {
      const result = calculerProgressionRPE(1, "intermediaire", config(), 50);
      expect(result.increment_count).toBeGreaterThanOrEqual(2);
    });

    it("RPE 10 → incrément négatif", () => {
      const result = calculerProgressionRPE(10, "intermediaire", config(), 50);
      expect(result.increment_count).toBeLessThan(0);
    });

    it("RPE 7 → 0 ou proche", () => {
      const result = calculerProgressionRPE(7, "intermediaire", config(), 50);
      expect(result.increment_count).toBeGreaterThanOrEqual(-1);
      expect(result.increment_count).toBeLessThanOrEqual(1);
    });

    it("historique facile → bonus incrément", () => {
      const result = calculerProgressionRPE(4, "intermediaire", config(), 50, [3, 4, 3]);
      expect(result.increment_count).toBeGreaterThan(0);
    });

    it("plateau détecté si RPE monte sans progression", () => {
      const result = calculerProgressionRPE(9, "intermediaire", config(), 50, [6, 8, 9]);
      expect(result.plateau_detecte).toBe(true);
    });

    it("deload suggéré si 2× RPE ≥ 9", () => {
      const result = calculerProgressionRPE(9, "intermediaire", config(), 50, [9, 9]);
      expect(result.deload_suggere).toBe(true);
    });

    it("débutant reçoit plus d'incrément qu'intermédiaire au même RPE", () => {
      const inter = calculerProgressionRPE(6, "intermediaire", config(), 50);
      const debut = calculerProgressionRPE(6, "debutant", config(), 50);
      expect(debut.increment_count).toBeGreaterThanOrEqual(inter.increment_count);
    });
  });

  describe("charge minimale", () => {
    it("ne descend pas sous 0", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ pas: 2.5 }), 2.5);
      expect(result.nouvelle_charge).toBe(0);
    });
  });
});
