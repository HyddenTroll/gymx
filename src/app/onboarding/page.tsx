"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { trouverMeilleurProgramme, creerProgramme } from "@/lib/programme/programme-service";
import type { Niveau, Objectif, Materiel, Profil } from "@/types";
import type { ProgrammeTemplate } from "@/lib/programme/templates";

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
    niveau: null, jours_par_semaine: null, objectif: null, materiel: null,
    exclus: [], charges: {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exercices, setExercices] = useState<any[]>([]);
  const [chargesExos, setChargesExos] = useState<any[]>([]);
  const [programmeChoisi, setProgrammeChoisi] = useState<ProgrammeTemplate | null>(null);

  const update = <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const steps: Step[] = ["niveau", "jours", "objectif", "materiel", "exclus", "charges", "programme"];
  const currentIndex = steps.indexOf(step);

  const next = () => { if (currentIndex < steps.length - 1) setStep(steps[currentIndex + 1]); };
  const prev = () => { if (currentIndex > 0) setStep(steps[currentIndex - 1]); };

  useEffect(() => {
    if (step === "exclus" && exercices.length === 0) {
      supabase.from("exercices").select("id, nom_fr, groupe, image_url").order("groupe").order("nom_fr").then(({ data }: any) => {
        if (data) setExercices(data);
      });
    }
    if (step === "charges" && chargesExos.length === 0) {
      supabase.from("exercices").select("id, nom_fr, groupe, role, unite_par_defaut").eq("role", "principal").order("groupe").then(({ data }: any) => {
        if (data) setChargesExos(data);
      });
    }
  }, [step, exercices.length, chargesExos.length, supabase]);

  const toggleExclus = (id: string) => {
    setState((prev) => ({
      ...prev,
      exclus: prev.exclus.includes(id) ? prev.exclus.filter((e) => e !== id) : [...prev.exclus, id],
    }));
  };

  const saveAndRedirect = async () => {
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const profil: Profil = {
        niveau: state.niveau!, jours_par_semaine: state.jours_par_semaine! as 3 | 4 | 5 | 6,
        objectif: state.objectif!, materiel: state.materiel!,
      };

      const { error: profilError } = await supabase
        .from("profil").upsert({ user_id: user.id, ...profil }, { onConflict: "user_id" });
      if (profilError) throw profilError;

      if (state.exclus.length > 0) {
        const { error: exclError } = await supabase
          .from("exercices_exclus")
          .upsert(state.exclus.map((id) => ({ user_id: user.id, exercice_id: id })), { onConflict: "user_id,exercice_id" });
        if (exclError) throw exclError;
      }

      for (const [exId, charge] of Object.entries(state.charges).filter(([_, v]) => v > 0)) {
        const { data: exo } = await supabase.from("exercices").select("unite_par_defaut, pas_par_defaut, assist_inverse").eq("id", exId).single();
        if (exo) {
          await supabase.from("charges").upsert({
            user_id: user.id, exercice_id: exId, charge_actuelle: charge,
            unite: exo.unite_par_defaut, pas: exo.pas_par_defaut,
            sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0,
          }, { onConflict: "user_id,exercice_id" });
        }
      }

      if (programmeChoisi) {
        const ok = await creerProgramme(user.id, programmeChoisi);
        if (!ok) throw new Error("Erreur lors de la création du programme");
      }

      router.push("/qg");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  const renderOptions = <T,>(
    options: { value: T; label: string; desc?: string }[],
    selected: T | null,
    onSelect: (v: T) => void
  ) => (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => { onSelect(opt.value); next(); }}
          className={`w-full text-left px-4 py-3.5 rounded-lg border transition-colors active:scale-[0.98] touch-target ${
            selected === opt.value
              ? "border-gymx-cyan bg-gymx-cyan/10"
              : "border-gymx-border bg-gymx-panel"
          }`}
        >
          <div className="font-display text-sm text-gymx-text">{opt.label}</div>
          {opt.desc && <div className="text-xs text-gymx-muted mt-0.5 leading-relaxed">{opt.desc}</div>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-dvh bg-gymx-bg p-4 safe-area-top safe-area-bottom flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
        <div className="w-full hud-panel p-5 space-y-5">
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= currentIndex ? "bg-gymx-cyan" : "bg-gymx-border"}`} />
            ))}
          </div>

          <h2 className="font-display text-base text-gymx-cyan text-center">{stepNames[step]}</h2>

          {step === "niveau" && renderOptions(niveauOptions, state.niveau, (v) => update("niveau", v))}
          {step === "jours" && (
            <div className="grid grid-cols-2 gap-2">
              {joursOptions.map((n) => (
                <button key={n} onClick={() => { update("jours_par_semaine", n); next(); }}
                  className={`py-4 rounded-lg border text-center transition-colors active:scale-[0.98] touch-target ${
                    state.jours_par_semaine === n ? "border-gymx-cyan bg-gymx-cyan/10" : "border-gymx-border bg-gymx-panel"
                  }`}>
                  <span className="font-display text-2xl text-gymx-text">{n}</span>
                  <span className="text-xs text-gymx-muted block mt-0.5">jours</span>
                </button>
              ))}
            </div>
          )}
          {step === "objectif" && renderOptions(objectifOptions, state.objectif, (v) => update("objectif", v))}
          {step === "materiel" && renderOptions(materielOptions, state.materiel, (v) => update("materiel", v))}

          {step === "exclus" && (
            <div className="space-y-2 max-h-[55dvh] overflow-y-auto overscroll-contain">
              <p className="text-gymx-muted text-xs leading-relaxed">
                Sélectionne les exercices que tu ne peux pas ou ne veux pas faire.
              </p>
              {exercices.length === 0 ? (
                <p className="text-gymx-muted text-xs text-center py-6">Chargement…</p>
              ) : (
                (() => {
                  const groups = exercices.reduce((acc: any, exo: any) => {
                    (acc[exo.groupe] = acc[exo.groupe] || []).push(exo); return acc;
                  }, {} as Record<string, any[]>);
                  return Object.entries(groups).map(([groupe, exos]) => (
                    <div key={groupe} className="space-y-1">
                      <p className="text-[10px] text-gymx-muted font-display uppercase tracking-wider px-1">{groupe}</p>
                      {(exos as any[]).map((exo: any) => (
                        <button key={exo.id} onClick={() => toggleExclus(exo.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors active:scale-[0.98] touch-target ${
                            state.exclus.includes(exo.id) ? "border-gymx-magenta bg-gymx-magenta/10" : "border-gymx-border bg-gymx-panel"
                          }`}>
                          {exo.image_url ? (
                            <img src={exo.image_url} alt="" className="w-9 h-9 rounded object-cover bg-gymx-bg2 shrink-0" loading="lazy" />
                          ) : (
                            <div className="w-9 h-9 rounded bg-gymx-bg2 flex items-center justify-center shrink-0">
                              <span className="text-[10px] text-gymx-muted">?</span>
                            </div>
                          )}
                          <span className="flex-1 text-left text-xs text-gymx-text">{exo.nom_fr}</span>
                          <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${
                            state.exclus.includes(exo.id) ? "border-gymx-magenta bg-gymx-magenta text-white" : "border-gymx-muted"
                          }`}>
                            {state.exclus.includes(exo.id) ? "✕" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  ));
                })()
              )}
              <button onClick={next} className="w-full bg-gymx-cyan/10 border border-gymx-cyan text-gymx-cyan font-display text-sm py-3.5 rounded-lg active:bg-gymx-cyan/20 touch-target mt-1">
                {state.exclus.length > 0 ? `✓ ${state.exclus.length} exclus · CONTINUER"` : "AUCUN EXCLU · CONTINUER"}
              </button>
            </div>
          )}

          {step === "charges" && (
            <div className="space-y-2 max-h-[55dvh] overflow-y-auto overscroll-contain">
              <p className="text-gymx-muted text-xs leading-relaxed">
                Charge de départ pour les mouvements principaux (laisse vide si inconnu).
              </p>
              {chargesExos.length === 0 ? (
                <p className="text-gymx-muted text-xs text-center py-6">Chargement…</p>
              ) : (
                chargesExos.map((exo: any) => (
                  <div key={exo.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gymx-border bg-gymx-panel">
                    <span className="text-xs text-gymx-text flex-1 leading-tight">{exo.nom_fr}</span>
                    <input
                      type="number" inputMode="decimal" placeholder="0"
                      value={state.charges[exo.id] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : 0;
                        setState((p) => ({ ...p, charges: { ...p.charges, [exo.id]: val } }));
                      }}
                      className="w-16 bg-gymx-bg border border-gymx-border rounded px-2 py-2 text-center text-sm text-gymx-text"
                      style={{ fontSize: "16px" }}
                    />
                    <span className="text-[10px] text-gymx-muted w-5 text-center">{exo.unite_par_defaut}</span>
                  </div>
                ))
              )}
              <button onClick={next} className="w-full bg-gymx-cyan/10 border border-gymx-cyan text-gymx-cyan font-display text-sm py-3.5 rounded-lg active:bg-gymx-cyan/20 touch-target mt-1">
                CONTINUER
              </button>
            </div>
          )}

          {step === "programme" && (
            <div className="space-y-4">
              {(() => {
                if (!programmeChoisi && state.niveau && state.objectif && state.jours_par_semaine && state.materiel) {
                  const found = trouverMeilleurProgramme(state.niveau, state.objectif, state.jours_par_semaine, state.materiel);
                  if (found && !programmeChoisi) setProgrammeChoisi(found);
                }
                return null;
              })()}

              {programmeChoisi ? (
                <div className="space-y-3">
                  <div className="hud-panel p-4 space-y-2 border-gymx-cyan">
                    <h3 className="font-display text-sm text-gymx-cyan">{programmeChoisi.nom}</h3>
                    <p className="text-xs text-gymx-muted leading-relaxed">{programmeChoisi.description}</p>
                    <div className="flex gap-2 pt-1">
                      <span className="text-[10px] bg-gymx-cyan/10 text-gymx-cyan px-2 py-0.5 rounded">{programmeChoisi.jours_par_semaine}j/sem</span>
                      <span className="text-[10px] bg-gymx-violet/10 text-gymx-violet px-2 py-0.5 rounded">{programmeChoisi.duree_semaines} sem</span>
                    </div>
                  </div>
                  {error && <p className="text-gymx-magenta text-xs text-center leading-relaxed">{error}</p>}
                  <button onClick={saveAndRedirect} disabled={saving}
                    className="w-full bg-gymx-violet/10 border border-gymx-violet text-gymx-violet font-display font-bold py-3.5 rounded-lg active:bg-gymx-violet/20 transition-colors disabled:opacity-30 touch-target">
                    {saving ? "CRÉATION…" : "COMMENCER L'AVENTURE"}
                  </button>
                </div>
              ) : (
                <p className="text-gymx-muted text-xs text-center py-6">Aucun programme trouvé pour ton profil.</p>
              )}
            </div>
          )}

          {step !== "niveau" && step !== "programme" && (
            <button onClick={prev} className="w-full text-gymx-muted font-display text-sm py-3 border border-gymx-border rounded-lg active:bg-gymx-bg2 transition-colors touch-target">
              RETOUR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
