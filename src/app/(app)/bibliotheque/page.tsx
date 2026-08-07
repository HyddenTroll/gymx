"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter } from "lucide-react";

const groupes = [
  "Pectoraux", "Épaules", "Dos", "Quadriceps",
  "Ischios/Fessiers", "Biceps", "Triceps", "Mollets", "Abdos",
];

const equipements = ["salle", "halteres", "corps"] as const;

export default function BibliothequePage() {
  const supabase = createClient();
  const [exercices, setExercices] = useState<any[]>([]);
  const [filtreGroupe, setFiltreGroupe] = useState<string | null>(null);
  const [filtreEquip, setFiltreEquip] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let query = supabase.from("exercices").select("*").order("nom_fr");

      if (filtreGroupe) query = query.eq("groupe", filtreGroupe);
      if (filtreEquip) query = query.eq("equipement", filtreEquip);

      const { data } = await query;
      if (data) {
        let filtered = data;
        if (search) {
          const s = search.toLowerCase();
          filtered = data.filter((e: any) => e.nom_fr.toLowerCase().includes(s));
        }
        setExercices(filtered);
      }
      setLoading(false);
    })();
  }, [supabase, filtreGroupe, filtreEquip, search]);

  return (
    <div className="min-h-dvh bg-gymx-bg p-4 space-y-4 safe-area-bottom">
      <header className="pt-2">
        <h1 className="font-display text-xl text-gymx-cyan">Bibliothèque</h1>
        <p className="text-gymx-muted text-xs">Exercices</p>
      </header>

      {/* RECHERCHE */}
      <div className="flex items-center gap-2 hud-panel px-3 py-2">
        <Search className="w-4 h-4 text-gymx-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un exercice…"
          className="flex-1 bg-transparent text-sm text-gymx-text placeholder-gymx-muted/50 outline-none"
        />
      </div>

      {/* FILTRES */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFiltreGroupe(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-display border transition-all ${
            !filtreGroupe
              ? "border-gymx-cyan text-gymx-cyan bg-gymx-cyan/10"
              : "border-gymx-border text-gymx-muted"
          }`}
        >
          Tous
        </button>
        {groupes.map((g) => (
          <button
            key={g}
            onClick={() => setFiltreGroupe(g === filtreGroupe ? null : g)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-display border transition-all ${
              filtreGroupe === g
                ? "border-gymx-cyan text-gymx-cyan bg-gymx-cyan/10"
                : "border-gymx-border text-gymx-muted"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* FILTRES EQUIPEMENT */}
      <div className="flex gap-2">
        {equipements.map((eq) => (
          <button
            key={eq}
            onClick={() => setFiltreEquip(eq === filtreEquip ? null : eq)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border transition-all ${
              filtreEquip === eq
                ? "border-gymx-violet text-gymx-violet bg-gymx-violet/10"
                : "border-gymx-border text-gymx-muted"
            }`}
          >
            <Filter className="w-3 h-3" />
            {eq === "salle" ? "Salle" : eq === "halteres" ? "Haltères" : "Poids du corps"}
          </button>
        ))}
      </div>

      {/* LISTE */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
        </div>
      ) : exercices.length === 0 ? (
        <div className="hud-panel p-8 text-center">
          <p className="text-gymx-muted text-sm">Aucun exercice trouvé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {exercices.map((exo: any) => (
            <div key={exo.id} className="hud-panel flex items-start gap-3 p-3 animate-slide-up">
              {exo.image_url ? (
                <img
                  src={exo.image_url}
                  alt={exo.nom_fr}
                  className="w-16 h-16 rounded-lg object-cover bg-gymx-bg2 shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gymx-bg2 flex items-center justify-center shrink-0">
                  <span className="font-display text-xs text-gymx-muted">?</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-sm text-gymx-text truncate">{exo.nom_fr}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gymx-muted bg-gymx-bg2 px-1.5 py-0.5 rounded">
                    {exo.groupe}
                  </span>
                  <span className="text-[10px] text-gymx-muted">
                    {exo.equipement === "salle" ? "Salle" : exo.equipement === "halteres" ? "Haltères" : "Corps"}
                  </span>
                </div>
                <p className="text-[10px] text-gymx-muted mt-1">
                  {exo.compound ? "Composé" : "Isolation"} · {exo.role === "principal" ? "Principal" : "Accessoire"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
