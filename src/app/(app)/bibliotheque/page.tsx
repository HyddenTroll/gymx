"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Activity, Library } from "lucide-react";
import Link from "next/link";

const groupes = ["Pectoraux", "Épaules", "Dos", "Quadriceps", "Ischios/Fessiers", "Biceps", "Triceps", "Mollets", "Abdos"];
const equipements = ["salle", "halteres", "corps"] as const;

const navItems = [
  { href: "/qg", label: "QG", icon: Activity },
  { href: "/seance", label: "Séance", icon: Search },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/progression", label: "Progression", icon: Activity },
];

export default function BibliothequePage() {
  const supabase = createClient();
  const [exercices, setExercices] = useState<any[]>([]);
  const [filtreGroupe, setFiltreGroupe] = useState<string | null>(null);
  const [filtreEquip, setFiltreEquip] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let q = supabase.from("exercices").select("*").order("nom_fr");
      if (filtreGroupe) q = q.eq("groupe", filtreGroupe);
      if (filtreEquip) q = q.eq("equipement", filtreEquip);
      const { data } = await q;
      if (data) {
        let filtered = data;
        if (search) { const s = search.toLowerCase(); filtered = data.filter((e: any) => e.nom_fr.toLowerCase().includes(s)); }
        setExercices(filtered);
      }
      setLoading(false);
    })();
  }, [supabase, filtreGroupe, filtreEquip, search]);

  return (
    <div className="min-h-dvh bg-gymx-bg flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 safe-area-top">
        <header className="pt-1">
          <h1 className="font-display text-lg text-gymx-cyan">Bibliothèque</h1>
          <p className="text-gymx-muted text-xs">Exercices</p>
        </header>

        <div className="flex items-center gap-2 hud-panel px-3 py-2.5">
          <Search className="w-4 h-4 text-gymx-muted shrink-0" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un exercice…"
            className="flex-1 bg-transparent text-sm text-gymx-text placeholder-gymx-muted/50 outline-none"
            style={{ fontSize: "16px" }} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 overscroll-contain">
          <button onClick={() => setFiltreGroupe(null)}
            className={`shrink-0 px-3 py-2 rounded-full text-[10px] font-display border transition-colors touch-target ${
              !filtreGroupe ? "border-gymx-cyan text-gymx-cyan bg-gymx-cyan/10" : "border-gymx-border text-gymx-muted"
            }`}>Tous</button>
          {groupes.map((g) => (
            <button key={g} onClick={() => setFiltreGroupe(g === filtreGroupe ? null : g)}
              className={`shrink-0 px-3 py-2 rounded-full text-[10px] font-display border transition-colors touch-target ${
                filtreGroupe === g ? "border-gymx-cyan text-gymx-cyan bg-gymx-cyan/10" : "border-gymx-border text-gymx-muted"
              }`}>{g}</button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {equipements.map((eq) => (
            <button key={eq} onClick={() => setFiltreEquip(eq === filtreEquip ? null : eq)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] border transition-colors touch-target ${
                filtreEquip === eq ? "border-gymx-violet text-gymx-violet bg-gymx-violet/10" : "border-gymx-border text-gymx-muted"
              }`}>
              {eq === "salle" ? "Salle" : eq === "halteres" ? "Haltères" : "Poids du corps"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
          </div>
        ) : exercices.length === 0 ? (
          <div className="hud-panel p-6 text-center">
            <p className="text-gymx-muted text-sm">Aucun exercice trouvé.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {exercices.map((exo: any) => (
              <div key={exo.id} className="hud-panel flex items-start gap-2.5 p-2.5">
                {exo.image_url ? (
                  <img src={exo.image_url} alt={exo.nom_fr} className="w-14 h-14 rounded-lg object-cover bg-gymx-bg2 shrink-0" loading="lazy" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gymx-bg2 flex items-center justify-center shrink-0">
                    <span className="font-display text-xs text-gymx-muted">?</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-sm text-gymx-text truncate">{exo.nom_fr}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gymx-muted bg-gymx-bg2 px-1.5 py-0.5 rounded">{exo.groupe}</span>
                    <span className="text-[10px] text-gymx-muted">
                      {exo.equipement === "salle" ? "Salle" : exo.equipement === "halteres" ? "Haltères" : "Corps"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gymx-muted mt-0.5">
                    {exo.compound ? "Composé" : "Isolation"} · {exo.role === "principal" ? "Principal" : "Accessoire"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 hud-panel mx-2 mb-1 px-1 py-1 flex justify-around items-center z-50" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-gymx-muted active:text-gymx-cyan transition-colors touch-target">
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-display">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
