"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { trouverMeilleurProgramme, creerProgramme } from "@/lib/programme/programme-service";
import type { Niveau, Objectif, Materiel } from "@/types";
import type { ProgrammeTemplate } from "@/lib/programme/templates";

type Step = "niveau" | "jours" | "objectif" | "materiel" | "exclus" | "charges" | "programme";

interface OnboardingState {
  niveau: Niveau | null; jours_par_semaine: number | null;
  objectif: Objectif | null; materiel: Materiel | null;
  exclus: string[]; charges: Record<string, number>;
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
  niveau: "Ton niveau", jours: "Combien de jours par semaine ?",
  objectif: "Ton objectif", materiel: "Ton matériel",
  exclus: "Exercices à éviter", charges: "Charges de départ", programme: "Ton programme",
};

const BtnBase = "w-full text-left px-4 py-3.5 rounded-xl border transition-colors active:scale-[0.98] touch-target";
const BgSurface = "var(--color-gymx-surface)";
const BgBg = "var(--color-gymx-bg)";
const BorderC = "var(--color-gymx-border)";
const Muted = "var(--color-gymx-muted)";
const Accent = "var(--color-gymx-accent)";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("niveau");
  const [state, setState] = useState<OnboardingState>({
    niveau: null, jours_par_semaine: null, objectif: null, materiel: null, exclus: [], charges: {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exercices, setExercices] = useState<any[]>([]);
  const [chargesExos, setChargesExos] = useState<any[]>([]);
  const [programmeChoisi, setProgrammeChoisi] = useState<ProgrammeTemplate | null>(null);
  const update = <K extends keyof OnboardingState>(k: K, v: OnboardingState[K]) => setState((p) => ({ ...p, [k]: v }));
  const steps: Step[] = ["niveau", "jours", "objectif", "materiel", "exclus", "charges", "programme"];
  const ci = steps.indexOf(step);
  const next = () => { if (ci < steps.length - 1) setStep(steps[ci + 1]); };
  const prev = () => { if (ci > 0) setStep(steps[ci - 1]); };

  useEffect(() => {
    if (step === "exclus" && exercices.length === 0) {
      supabase.from("exercices").select("id, nom_fr, groupe, image_url").order("groupe").order("nom_fr").then(({ data }: any) => { if (data) setExercices(data); });
    }
    if (step === "charges" && chargesExos.length === 0) {
      supabase.from("exercices").select("id, nom_fr, groupe, role, unite_par_defaut").eq("role", "principal").order("groupe").then(({ data }: any) => { if (data) setChargesExos(data); });
    }
  }, [step, exercices.length, chargesExos.length, supabase]);

  const toggleExclus = (id: string) => setState((p) => ({ ...p, exclus: p.exclus.includes(id) ? p.exclus.filter((e) => e !== id) : [...p.exclus, id] }));

  const saveAndRedirect = async () => {
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await supabase.from("profil").upsert({ user_id: user.id, niveau: state.niveau!, jours_par_semaine: state.jours_par_semaine!, objectif: state.objectif!, materiel: state.materiel! }, { onConflict: "user_id" });
      if (state.exclus.length > 0) {
        await supabase.from("exercices_exclus").upsert(state.exclus.map((id) => ({ user_id: user.id, exercice_id: id })), { onConflict: "user_id,exercice_id" });
      }
      for (const [exId, charge] of Object.entries(state.charges).filter(([_, v]) => v > 0)) {
        const { data: exo } = await supabase.from("exercices").select("unite_par_defaut, pas_par_defaut, assist_inverse").eq("id", exId).single();
        if (exo) { await supabase.from("charges").upsert({ user_id: user.id, exercice_id: exId, charge_actuelle: charge, unite: exo.unite_par_defaut, pas: exo.pas_par_defaut, sens: exo.assist_inverse ? "inverse" : "normal", compteur_echecs: 0 }, { onConflict: "user_id,exercice_id" }); }
      }
      if (programmeChoisi) {
        console.log("[onboarding] creating program...");
        const ok = await creerProgramme(user.id, programmeChoisi);
        if (!ok) throw new Error("Erreur lors de la création du programme");
        console.log("[onboarding] program created");
      }
      router.push("/qg");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      console.error("[onboarding] error:", msg);
      setError(msg);
    } finally { setSaving(false); }
  };

  const s = (sel: boolean) => `${BtnBase} ${sel ? "border-gymx-accent bg-gymx-accent/5" : "border-gymx-border"}`;

  return (
    <div className="min-h-dvh flex flex-col p-4 safe-area-top safe-area-bottom" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
        <div className="w-full card p-5 space-y-5">
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (<div key={s} className={`h-0.5 flex-1 rounded-full transition-colors ${i <= ci ? "bg-gymx-accent" : "bg-gymx-border"}`} />))}
          </div>
          <h2 className="card-title text-center">{stepNames[step]}</h2>

          {step === "niveau" && (
            <div className="space-y-2">
              {niveauOptions.map((o) => (
                <button key={o.value} onClick={() => { update("niveau", o.value); next(); }} className={s(state.niveau === o.value)}
                  style={{ backgroundColor: BgSurface }}>
                  <div className="font-display font-bold text-[15px] text-gymx-text">{o.label}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: Muted }}>{o.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === "jours" && (
            <div className="grid grid-cols-2 gap-2">
              {joursOptions.map((n) => (
                <button key={n} onClick={() => { update("jours_par_semaine", n); next(); }}
                  className={`py-4 rounded-xl border text-center transition-colors active:scale-[0.98] touch-target ${state.jours_par_semaine === n ? "border-gymx-accent bg-gymx-accent/5" : "border-gymx-border"}`}
                  style={{ backgroundColor: BgSurface }}>
                  <span className="hero-value text-2xl">{n}</span>
                  <p className="label mt-0.5">jours</p>
                </button>
              ))}
            </div>
          )}

          {step === "objectif" && (
            <div className="space-y-2">
              {objectifOptions.map((o) => (
                <button key={o.value} onClick={() => { update("objectif", o.value); next(); }} className={s(state.objectif === o.value)}
                  style={{ backgroundColor: BgSurface }}>
                  <div className="font-display font-bold text-[15px] text-gymx-text">{o.label}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: Muted }}>{o.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === "materiel" && (
            <div className="space-y-2">
              {materielOptions.map((o) => (
                <button key={o.value} onClick={() => { update("materiel", o.value); next(); }} className={s(state.materiel === o.value)}
                  style={{ backgroundColor: BgSurface }}>
                  <div className="font-display font-bold text-[15px] text-gymx-text">{o.label}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: Muted }}>{o.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === "exclus" && (
            <div className="space-y-2 max-h-[55dvh] overflow-y-auto overscroll-contain">
              <p className="text-xs leading-relaxed" style={{ color: Muted }}>Sélectionne les exercices que tu ne peux pas ou ne veux pas faire.</p>
              {exercices.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: Muted }}>Chargement…</p>
              ) : (
                (() => {
                  const groups = exercices.reduce((acc: any, exo: any) => { (acc[exo.groupe] = acc[exo.groupe] || []).push(exo); return acc; }, {});
                  return Object.entries(groups).map(([groupe, exos]) => (
                    <div key={groupe} className="space-y-1">
                      <p className="label text-[10px] px-1">{groupe}</p>
                      {(exos as any[]).map((exo: any) => (
                        <button key={exo.id} onClick={() => toggleExclus(exo.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-colors active:scale-[0.98] touch-target ${state.exclus.includes(exo.id) ? "border-gymx-accent" : "border-gymx-border"}`}
                          style={{ backgroundColor: BgSurface }}>
                          {exo.image_url ? (
                            <img src={exo.image_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" loading="lazy" style={{ backgroundColor: BgBg }} />
                          ) : (
                            <div className="w-9 h-9 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: BgBg }}>
                              <span className="text-[10px]" style={{ color: Muted }}>?</span>
                            </div>
                          )}
                          <span className="flex-1 text-left text-sm text-gymx-text">{exo.nom_fr}</span>
                          <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${state.exclus.includes(exo.id) ? "border-gymx-accent bg-gymx-accent text-white" : ""}`}
                            style={{ borderColor: state.exclus.includes(exo.id) ? Accent : BorderC }}>
                            {state.exclus.includes(exo.id) ? "✕" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  ));
                })()
              )}
              <button onClick={next} className="w-full font-semibold text-sm py-3.5 rounded-xl transition-colors touch-target mt-1"
                style={{ backgroundColor: "var(--color-gymx-fill-strong)", color: "var(--color-gymx-surface)" }}>
                {state.exclus.length > 0 ? `${state.exclus.length} exclus · Continuer` : "Aucun exclu · Continuer"}
              </button>
            </div>
          )}

          {step === "charges" && (
            <div className="space-y-2 max-h-[55dvh] overflow-y-auto overscroll-contain">
              <p className="text-xs leading-relaxed" style={{ color: Muted }}>Charge de départ pour les mouvements principaux (laisse vide si inconnu).</p>
              {chargesExos.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: Muted }}>Chargement…</p>
              ) : (
                chargesExos.map((exo: any) => (
                  <div key={exo.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ borderColor: BorderC, backgroundColor: BgSurface }}>
                    <span className="text-sm text-gymx-text flex-1 leading-tight">{exo.nom_fr}</span>
                    <input type="number" inputMode="decimal" placeholder="0"
                      value={state.charges[exo.id] ?? ""}
                      onChange={(e) => { const v = e.target.value ? Number(e.target.value) : 0; setState((p) => ({ ...p, charges: { ...p.charges, [exo.id]: v } })); }}
                      className="w-16 border rounded px-2 py-2 text-center text-sm"
                      style={{ fontSize: "16px", borderColor: BorderC, backgroundColor: BgBg, color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                    <span className="text-[10px] w-5 text-center" style={{ color: Muted }}>{exo.unite_par_defaut}</span>
                  </div>
                ))
              )}
              <button onClick={next} className="w-full font-semibold text-sm py-3.5 rounded-xl transition-colors touch-target mt-1"
                style={{ backgroundColor: "var(--color-gymx-fill-strong)", color: "var(--color-gymx-surface)" }}>
                Continuer
              </button>
            </div>
          )}

          {step === "programme" && (
            <div className="space-y-4">
              {(() => {
                if (!programmeChoisi && state.niveau && state.objectif && state.jours_par_semaine && state.materiel) {
                  const f = trouverMeilleurProgramme(state.niveau, state.objectif, state.jours_par_semaine, state.materiel);
                  if (f && !programmeChoisi) setProgrammeChoisi(f);
                }
                return null;
              })()}
              {programmeChoisi ? (
                <div className="space-y-3">
                  <div className="card p-4 space-y-2 border-gymx-accent">
                    <h3 className="card-title">{programmeChoisi.nom}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: Muted }}>{programmeChoisi.description}</p>
                    <div className="flex gap-2 pt-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: BgBg, color: Muted }}>{programmeChoisi.jours_par_semaine}j/sem</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: BgBg, color: Muted }}>{programmeChoisi.duree_semaines} sem</span>
                    </div>
                  </div>
                  {error && <p className="text-xs text-center leading-relaxed" style={{ color: Accent }}>{error}</p>}
                  <button onClick={saveAndRedirect} disabled={saving}
                    className="w-full font-semibold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-30 touch-target"
                    style={{ backgroundColor: saving ? "var(--color-gymx-fill)" : "var(--color-gymx-fill-strong)", color: saving ? Muted : "var(--color-gymx-surface)" }}>
                    {saving ? "Création…" : "Commencer l'aventure"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-center py-6" style={{ color: Muted }}>Aucun programme trouvé pour ton profil.</p>
              )}
            </div>
          )}

          {step !== "niveau" && step !== "programme" && (
            <button onClick={prev} className="w-full text-sm font-semibold py-3 border rounded-xl transition-colors touch-target"
              style={{ borderColor: BorderC, color: Muted, backgroundColor: BgSurface }}>
              Retour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
