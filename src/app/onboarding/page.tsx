"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Niveau, Objectif, Materiel, Profil } from "@/types";

type Step =
  | "niveau"
  | "jours"
  | "objectif"
  | "materiel"
  | "exclus"
  | "charges"
  | "programme";

interface OnboardingState {
  niveau: Niveau | null;
  jours_par_semaine: number | null;
  objectif: Objectif | null;
  materiel: Materiel | null;
  exclus: string[];
  charges: Record<string, number>;
}

const niveauOptions: { value: Niveau; label: string; desc: string }[] = [
  { value: "debutant", label: "Débutant", desc: "Moins de 6 mois d'entraînement régulier" },
  { value: "intermediaire", label: "Intermédiaire", desc: "Entre 6 mois et 2 ans" },
  { value: "avance", label: "Avancé", desc: "Plus de 2 ans, maîtrise des mouvements" },
];

const joursOptions = [3, 4, 5, 6];

const objectifOptions: { value: Objectif; label: string; desc: string }[] = [
  { value: "force", label: "Force", desc: "Soulevé plus lourd à chaque séance" },
  { value: "muscle", label: "Prise de muscle (hypertrophie)", desc: "Développer ton volume musculaire" },
  { value: "recomposition", label: "Recomposition", desc: "Perdre du gras en gagnant du muscle" },
];

const materielOptions: { value: Materiel; label: string; desc: string }[] = [
  { value: "salle", label: "Salle complète", desc: "Barres, haltères, machines, poulies" },
  { value: "halteres", label: "Haltères + banc", desc: "Pas de barre ni machines" },
  { value: "corps", label: "Poids du corps", desc: "Tractions, pompes, dips, squat" },
];

const stepNames: Record<Step, string> = {
  niveau: "Ton niveau",
  jours: "Combien de jours par semaine ?",
  objectif: "Ton objectif",
  materiel: "Ton matériel",
  exclus: "Exercices à éviter",
  charges: "Charges de départ",
  programme: "Ton programme",
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("niveau");
  const [state, setState] = useState<OnboardingState>({
    niveau: null,
    jours_par_semaine: null,
    objectif: null,
    materiel: null,
    exclus: [],
    charges: {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof OnboardingState>(
    key: K,
    value: OnboardingState[K]
  ) => setState((prev) => ({ ...prev, [key]: value }));

  const steps: Step[] = ["niveau", "jours", "objectif", "materiel", "exclus", "charges", "programme"];
  const currentIndex = steps.indexOf(step);

  const next = () => {
    if (currentIndex < steps.length - 1) setStep(steps[currentIndex + 1]);
  };

  const prev = () => {
    if (currentIndex > 0) setStep(steps[currentIndex - 1]);
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "niveau": return state.niveau !== null;
      case "jours": return state.jours_par_semaine !== null;
      case "objectif": return state.objectif !== null;
      case "materiel": return state.materiel !== null;
      default: return true;
    }
  };

  const saveAndRedirect = async () => {
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const profil: Profil = {
        niveau: state.niveau!,
        jours_par_semaine: state.jours_par_semaine! as 3 | 4 | 5 | 6,
        objectif: state.objectif!,
        materiel: state.materiel!,
      };

      const { error: profilError } = await supabase
        .from("profil")
        .upsert({ user_id: user.id, ...profil });

      if (profilError) throw profilError;

      if (state.exclus.length > 0) {
        const { error: exclError } = await supabase
          .from("exercices_exclus")
          .insert(state.exclus.map((id) => ({ user_id: user.id, exercice_id: id })));

        if (exclError) throw exclError;
      }

      router.push("/seance");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gymx-bg p-4 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        <div className="w-full hud-panel p-6 space-y-6 animate-slide-up">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= currentIndex ? "bg-gymx-cyan" : "bg-gymx-border"
                }`}
              />
            ))}
          </div>

          <h2 className="font-display text-lg text-gymx-cyan text-center">
            {stepNames[step]}
          </h2>

          {/* NIVEAU */}
          {step === "niveau" && (
            <div className="space-y-3">
              {niveauOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { update("niveau", opt.value); next(); }}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    state.niveau === opt.value
                      ? "border-gymx-cyan bg-gymx-cyan/10 hud-glow-cyan"
                      : "border-gymx-border bg-gymx-panel"
                  }`}
                >
                  <div className="font-display text-sm text-gymx-text">{opt.label}</div>
                  <div className="text-xs text-gymx-muted mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* JOURS */}
          {step === "jours" && (
            <div className="grid grid-cols-2 gap-3">
              {joursOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => { update("jours_par_semaine", n); next(); }}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    state.jours_par_semaine === n
                      ? "border-gymx-cyan bg-gymx-cyan/10 hud-glow-cyan"
                      : "border-gymx-border bg-gymx-panel"
                  }`}
                >
                  <span className="font-display text-2xl text-gymx-text">{n}</span>
                  <span className="text-xs text-gymx-muted block mt-1">jours</span>
                </button>
              ))}
            </div>
          )}

          {/* OBJECTIF */}
          {step === "objectif" && (
            <div className="space-y-3">
              {objectifOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { update("objectif", opt.value); next(); }}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    state.objectif === opt.value
                      ? "border-gymx-cyan bg-gymx-cyan/10 hud-glow-cyan"
                      : "border-gymx-border bg-gymx-panel"
                  }`}
                >
                  <div className="font-display text-sm text-gymx-text">{opt.label}</div>
                  <div className="text-xs text-gymx-muted mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* MATERIEL */}
          {step === "materiel" && (
            <div className="space-y-3">
              {materielOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { update("materiel", opt.value); next(); }}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    state.materiel === opt.value
                      ? "border-gymx-cyan bg-gymx-cyan/10 hud-glow-cyan"
                      : "border-gymx-border bg-gymx-panel"
                  }`}
                >
                  <div className="font-display text-sm text-gymx-text">{opt.label}</div>
                  <div className="text-xs text-gymx-muted mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* EXCLUS */}
          {step === "exclus" && (
            <div className="space-y-4">
              <p className="text-gymx-muted text-sm">
                Tu pourras modifier ça à tout moment.
              </p>
              <div className="flex gap-3">
                <button onClick={next} className="flex-1 bg-gymx-cyan/10 border border-gymx-cyan text-gymx-cyan font-display text-sm py-3 rounded-lg">
                  PASSER
                </button>
              </div>
            </div>
          )}

          {/* CHARGES */}
          {step === "charges" && (
            <div className="space-y-4">
              <p className="text-gymx-muted text-sm">
                Tu pourras ajuster à la première séance. Laisse vide si tu ne sais pas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { update("charges", {}); next(); }}
                  className="flex-1 bg-gymx-cyan/10 border border-gymx-cyan text-gymx-cyan font-display text-sm py-3 rounded-lg"
                >
                  PASSER
                </button>
              </div>
            </div>
          )}

          {/* PROGRAMME */}
          {step === "programme" && (
            <div className="space-y-4">
              {error && <p className="text-gymx-magenta text-sm text-center">{error}</p>}
              <button
                onClick={saveAndRedirect}
                disabled={saving}
                className="w-full bg-gymx-violet/10 border border-gymx-violet text-gymx-violet font-display font-bold py-3 rounded-lg hud-glow-violet hover:bg-gymx-violet/20 transition-all disabled:opacity-30"
              >
                {saving ? "CRÉATION…" : "COMMENCER L'AVENTURE"}
              </button>
            </div>
          )}

          {/* Navigation */}
          {step !== "niveau" && step !== "programme" && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={prev}
                className="flex-1 text-gymx-muted font-display text-sm py-2 border border-gymx-border rounded-lg"
              >
                RETOUR
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
