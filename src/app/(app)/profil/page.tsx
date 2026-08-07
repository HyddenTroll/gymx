"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mettreAJourProfil, ajouterPoids, reintegrerExercice } from "@/lib/dashboard/projections";
import { getPoidsCorps } from "@/lib/dashboard/dashboard-service";
import { ArrowLeft, Weight, X } from "lucide-react";
import Link from "next/link";

export default function ProfilPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profil, setProfil] = useState<any>(null);
  const [poids, setPoids] = useState<any[]>([]);
  const [exclus, setExclus] = useState<any[]>([]);
  const [nouveauPoids, setNouveauPoids] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const niveaux = ["debutant", "intermediaire", "avance"];
  const joursOpts = [3, 4, 5, 6];
  const objectifs = ["force", "muscle", "recomposition"];
  const materiels = ["salle", "halteres", "corps"];

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profil").select("*").eq("user_id", user.id).single();
      if (p) { setProfil(p); setForm(p); }

      const pc = await getPoidsCorps();
      setPoids(pc);

      const { data: ex } = await supabase
        .from("exercices_exclus")
        .select("*, exercice:exercice_id(nom_fr, groupe, image_url)")
        .eq("user_id", user.id);
      if (ex) setExclus(ex);
    })();
  }, [router, supabase]);

  const handleSaveProfil = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const ok = await mettreAJourProfil(user.id, form);
    if (ok) { setProfil(form); setEditing(false); setMessage("Profil mis à jour"); }
    else setMessage("Erreur");
    setSaving(false);
    setTimeout(() => setMessage(""), 2000);
  };

  const handlePoids = async () => {
    const v = parseFloat(nouveauPoids);
    if (!v || v <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ok = await ajouterPoids(user.id, v);
    if (ok) {
      setNouveauPoids("");
      const pc = await getPoidsCorps();
      setPoids(pc);
      setMessage("Poids enregistré");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const handleReintegrer = async (exId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ok = await reintegrerExercice(user.id, exId);
    if (ok) setExclus((prev) => prev.filter((e) => e.exercice_id !== exId));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const label = (s: string) => <p className="label mt-3 mb-1">{s}</p>;

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <div className="flex items-center gap-3">
          <Link href="/qg" className="p-2 -ml-2 touch-target">
            <ArrowLeft className="w-5 h-5" style={{ color: "var(--color-gymx-text)" }} />
          </Link>
          <div>
            <h1 className="card-title">Profil</h1>
            <p className="label">Paramètres</p>
          </div>
        </div>

        {message && (
          <div className="card p-3 text-sm font-semibold" style={{ color: "var(--color-gymx-accent)" }}>
            {message}
          </div>
        )}

        <div className="card p-4 space-y-3">
          <p className="label">Mon profil</p>
          {editing ? (
            <>
              {label("Niveau")}
              <div className="flex gap-1.5">
                {niveaux.map((n) => (
                  <button key={n} onClick={() => setForm({ ...form, niveau: n })}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors touch-target"
                    style={{ backgroundColor: form.niveau === n ? "var(--color-gymx-accent)" : "var(--color-gymx-surface)", color: form.niveau === n ? "#fff" : "var(--color-gymx-text)", borderColor: form.niveau === n ? "var(--color-gymx-accent)" : "var(--color-gymx-border)" }}>
                    {n === "debutant" ? "Débutant" : n === "intermediaire" ? "Intermédiaire" : "Avancé"}
                  </button>
                ))}
              </div>
              {label("Jours / semaine")}
              <div className="flex gap-1.5">
                {joursOpts.map((j) => (
                  <button key={j} onClick={() => setForm({ ...form, jours_par_semaine: j })}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors touch-target"
                    style={{ backgroundColor: form.jours_par_semaine === j ? "var(--color-gymx-accent)" : "var(--color-gymx-surface)", color: form.jours_par_semaine === j ? "#fff" : "var(--color-gymx-text)", borderColor: form.jours_par_semaine === j ? "var(--color-gymx-accent)" : "var(--color-gymx-border)" }}>
                    {j}j
                  </button>
                ))}
              </div>
              {label("Objectif")}
              <div className="flex gap-1.5">
                {objectifs.map((o) => (
                  <button key={o} onClick={() => setForm({ ...form, objectif: o })}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors touch-target"
                    style={{ backgroundColor: form.objectif === o ? "var(--color-gymx-accent)" : "var(--color-gymx-surface)", color: form.objectif === o ? "#fff" : "var(--color-gymx-text)", borderColor: form.objectif === o ? "var(--color-gymx-accent)" : "var(--color-gymx-border)" }}>
                    {o === "force" ? "Force" : o === "muscle" ? "Muscle" : "Recomposition"}
                  </button>
                ))}
              </div>
              {label("Matériel")}
              <div className="flex gap-1.5">
                {materiels.map((m) => (
                  <button key={m} onClick={() => setForm({ ...form, materiel: m })}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors touch-target"
                    style={{ backgroundColor: form.materiel === m ? "var(--color-gymx-accent)" : "var(--color-gymx-surface)", color: form.materiel === m ? "#fff" : "var(--color-gymx-text)", borderColor: form.materiel === m ? "var(--color-gymx-accent)" : "var(--color-gymx-border)" }}>
                    {m === "salle" ? "Salle" : m === "halteres" ? "Haltères" : "Corps"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border touch-target"
                  style={{ borderColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                  Annuler
                </button>
                <button onClick={handleSaveProfil} disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold touch-target"
                  style={{ backgroundColor: "var(--color-gymx-fill-strong)", color: "var(--color-gymx-surface)" }}>
                  {saving ? "…" : "Enregistrer"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span style={{ color: "var(--color-gymx-muted)" }}>Niveau</span><span>{profil?.niveau === "debutant" ? "Débutant" : profil?.niveau === "intermediaire" ? "Intermédiaire" : "Avancé"}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--color-gymx-muted)" }}>Jours / semaine</span><span>{profil?.jours_par_semaine}j</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--color-gymx-muted)" }}>Objectif</span><span>{profil?.objectif === "force" ? "Force" : profil?.objectif === "muscle" ? "Hypertrophie" : "Recomposition"}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--color-gymx-muted)" }}>Matériel</span><span>{profil?.materiel === "salle" ? "Salle" : profil?.materiel === "halteres" ? "Haltères" : "Corps"}</span></div>
              </div>
              <button onClick={() => setEditing(true)}
                className="w-full py-3 rounded-xl text-sm font-semibold touch-target"
                style={{ backgroundColor: "var(--color-gymx-fill)", color: "var(--color-gymx-text)" }}>
                Modifier
              </button>
            </>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Weight className="w-4 h-4" style={{ color: "var(--color-gymx-muted)" }} />
            <p className="label">Poids du corps</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" step="0.1" placeholder="kg"
              value={nouveauPoids} onChange={(e) => setNouveauPoids(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2.5 text-sm"
              style={{ fontSize: "16px", borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
            <button onClick={handlePoids} disabled={!nouveauPoids}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold touch-target disabled:opacity-30"
              style={{ backgroundColor: "var(--color-gymx-fill-strong)", color: "var(--color-gymx-surface)" }}>
              Ajouter
            </button>
          </div>
          {poids.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {poids.slice(0, 15).map((d: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span style={{ color: "var(--color-gymx-muted)" }}>{new Date(d.date).toLocaleDateString("fr-FR")}</span>
                  <span className="font-mono" style={{ color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>{d.poids} kg</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 space-y-2">
          <p className="label">Exercices exclus</p>
          {exclus.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Aucun exercice exclu.</p>
          ) : (
            exclus.map((ex: any) => (
              <div key={ex.id} className="flex items-center justify-between py-1.5 border-b text-sm" style={{ borderColor: "var(--color-gymx-border)" }}>
                <span>{ex.exercice?.nom_fr || "—"}</span>
                <button onClick={() => handleReintegrer(ex.exercice_id)} className="p-1 touch-target">
                  <X className="w-4 h-4" style={{ color: "var(--color-gymx-muted)" }} />
                </button>
              </div>
            ))
          )}
        </div>

        <button onClick={handleSignOut}
          className="w-full py-3.5 rounded-xl text-sm font-semibold touch-target mt-2"
          style={{ border: "1px solid var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
          Déconnexion
        </button>
      </div>
    </div>
  );
}
