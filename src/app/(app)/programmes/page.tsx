"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recommanderProgrammes, creerProgramme, type Recommandation } from "@/lib/programme/programme-service";
import { ArrowLeft, Check, Dumbbell, Clock, Target, Users, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ProgrammesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profil, setProfil] = useState<any>(null);
  const [recommandations, setRecommandations] = useState<Recommandation[]>([]);
  const [selection, setSelection] = useState<string | null>(null);
  const [detail, setDetail] = useState<Recommandation | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profil").select("*").eq("user_id", user.id).single();
      if (p) {
        setProfil(p);
        const recos = recommanderProgrammes({ niveau: p.niveau, jours: p.jours_par_semaine, objectif: p.objectif, materiel: p.materiel });
        setRecommandations(recos);
      }
    })();
  }, [router, supabase]);

  const handleChanger = async (prog: Recommandation) => {
    if (!profil) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ok = await creerProgramme(user.id, prog.programme);
    if (ok) {
      setMessage("Nouveau programme : " + prog.programme.nom);
      setTimeout(() => router.push("/qg"), 1500);
    } else {
      setMessage("Erreur lors du changement de programme");
    }
    setCreating(false);
  };

  const iconeObjectif = (obj: string) => {
    if (obj === "force") return <Dumbbell className="w-4 h-4" />;
    if (obj === "muscle") return <Target className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <div className="flex items-center gap-3">
          <Link href="/profil" className="p-2 -ml-2 touch-target">
            <ArrowLeft className="w-5 h-5" style={{ color: "var(--color-gymx-text)" }} />
          </Link>
          <div>
            <h1 className="card-title">Programmes</h1>
            <p className="label">Choisis celui qui te correspond</p>
          </div>
        </div>

        {message && (
          <div className="card p-3 text-sm font-semibold text-center" style={{ color: "var(--color-gymx-accent)" }}>
            {message}
          </div>
        )}

        {profil && (
          <div className="card p-3 flex gap-2 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>
              {profil.niveau === "debutant" ? "Debutant" : profil.niveau === "intermediaire" ? "Intermediaire" : "Avance"}
            </span>
            <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>
              {profil.jours_par_semaine}j/sem
            </span>
            <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>
              {profil.objectif === "force" ? "Force" : profil.objectif === "muscle" ? "Hypertrophie" : "Recomposition"}
            </span>
            <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>
              {profil.materiel === "salle" ? "Salle" : profil.materiel === "halteres" ? "Halteres" : "Corps"}
            </span>
          </div>
        )}

        {detail ? (
          <div className="space-y-4 animate-fade-in">
            <button onClick={() => setDetail(null)} className="text-sm font-semibold touch-target" style={{ color: "var(--color-gymx-muted)" }}>
              &larr; Retour a la liste
            </button>
            <div className="card p-5 space-y-4">
              <div>
                <h2 className="card-title text-lg">{detail.programme.nom}</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-gymx-muted)" }}>par {detail.programme.auteur}</p>
              </div>
              {detail.match_pct > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-accent)" }}>{detail.match_pct}% de match</span>
                  <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-gymx-fill)" }}>
                    <div className="h-full rounded-full" style={{ width: detail.match_pct + "%", backgroundColor: "var(--color-gymx-accent)" }} />
                  </div>
                </div>
              )}
              <p className="text-sm leading-relaxed">{detail.programme.description_longue}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="card p-3 text-center space-y-1">
                  <Clock className="w-4 h-4 mx-auto" style={{ color: "var(--color-gymx-muted)" }} />
                  <p className="text-xs font-semibold">{detail.programme.jours_par_semaine}j / sem</p>
                  <p className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>{detail.programme.duree_semaines} semaines</p>
                </div>
                <div className="card p-3 text-center space-y-1">
                  {iconeObjectif(detail.programme.objectifs[0])}
                  <p className="text-xs font-semibold">{detail.programme.objectifs[0] === "force" ? "Force" : detail.programme.objectifs[0] === "muscle" ? "Hypertrophie" : "Recomposition"}</p>
                  <p className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>Objectif principal</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="label text-[10px]">Structure de la semaine</p>
                {detail.programme.structure.map((j) => (
                  <div key={j.jour} className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-xs w-20" style={{ color: "var(--color-gymx-muted)" }}>{j.nom_jour || ("Jour " + j.jour)}</span>
                    <span className="text-xs">{j.exercices.length} exercices</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="label text-[10px]">Pour qui</p>
                <p className="text-sm">{detail.programme.pour_qui}</p>
              </div>
              {detail.programme.pas_pour_qui && (
                <div className="space-y-1">
                  <p className="label text-[10px]">Pas pour</p>
                  <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>{detail.programme.pas_pour_qui}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="label text-[10px]">Progression</p>
                <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>{detail.programme.progression}</p>
              </div>
              <button onClick={() => handleChanger(detail)} disabled={creating} className="w-full py-3.5 rounded-xl font-semibold text-sm touch-target disabled:opacity-30" style={{ backgroundColor: "var(--color-gymx-accent)", color: "#0a0a0b" }}>
                {creating ? "Creation..." : "Choisir ce programme"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => router.push("/programmes/generer")} className="w-full card p-4 text-left space-y-2 active:scale-[0.98] touch-target" style={{ borderColor: "var(--color-gymx-accent)" }}>
              <h3 className="font-semibold text-[15px]" style={{ color: "var(--color-gymx-accent)" }}>Generer un programme sur mesure</h3>
              <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Construit automatiquement selon tes preferences</p>
            </button>
            <p className="label">Programmes recommandes</p>
            {recommandations.map((rec, i) => (
              <button key={rec.programme.id} onClick={() => setDetail(rec)} className={"w-full card p-4 text-left space-y-2 transition-all active:scale-[0.98] touch-target" + (!rec.eligible ? " opacity-40" : "")}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-semibold text-[15px] text-gymx-text">{rec.programme.nom}</h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-gymx-muted)" }}>{rec.programme.auteur}</p>
                  </div>
                  {rec.eligible ? (
                    <span className="text-xs font-bold" style={{ color: "var(--color-gymx-accent)" }}>{rec.match_pct}%</span>
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: rec.eligible ? "var(--color-gymx-text)" : "var(--color-gymx-muted)" }}>
                  {rec.programme.description_courte}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>{rec.programme.jours_par_semaine}j/sem</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)" }}>{rec.programme.duree_semaines} sem</span>
                  {rec.programme.objectifs.map((o) => (
                    <span key={o} className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "var(--color-gymx-accent)" }}>
                      {o === "force" ? "Force" : o === "muscle" ? "Muscle" : "Recomp"}
                    </span>
                  ))}
                </div>
                {!rec.eligible && rec.raison_ineligible && (
                  <p className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{rec.raison_ineligible}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
