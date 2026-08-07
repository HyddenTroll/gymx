import { describe, it, expect } from "vitest";
import { calculerProgression } from "./engine";
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
      ["a_la_limite", 0],
      ["impossible", -2],
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
      ["impossible", -2],
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

    it("impossible → -2 reps", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ unite: "reps", pas: 1 }), 8);
      expect(result.nouvelle_charge).toBe(6);
    });
  });

  describe("sens inverse (assistance) — §5.5", () => {
    it("facile → réduit l'assistance (-pas)", () => {
      const result = calculerProgression("facile", "intermediaire", config({ sens: "inverse", pas: 2 }), 20);
      expect(result.increment_count).toBe(-2);
      expect(result.nouvelle_charge).toBe(16);
    });

    it("impossible → augmente l'assistance (+pas)", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ sens: "inverse", pas: 2 }), 20);
      expect(result.increment_count).toBe(2);
      expect(result.nouvelle_charge).toBe(24);
    });
  });

  describe("deload — §5.5 + §5.6", () => {
    it("premier impossible → deload -2, compteur = 1", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ compteur_echecs: 0 }), 50);
      expect(result.nouvelle_charge).toBe(45);
      expect(result.nouveau_compteur_echecs).toBe(1);
      expect(result.deload).toBe(true);
    });

    it("deuxième impossible consécutif → deload -2, compteur = 2", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ compteur_echecs: 1 }), 45);
      expect(result.nouvelle_charge).toBe(40);
      expect(result.nouveau_compteur_echecs).toBe(2);
    });

    it("facile reset le compteur à 0", () => {
      const result = calculerProgression("facile", "intermediaire", config({ compteur_echecs: 2 }), 40);
      expect(result.nouveau_compteur_echecs).toBe(0);
    });
  });

  describe("charge minimale", () => {
    it("ne descend pas sous 0", () => {
      const result = calculerProgression("impossible", "intermediaire", config({ pas: 2.5 }), 2.5);
      expect(result.nouvelle_charge).toBe(0);
    });
  });
});
