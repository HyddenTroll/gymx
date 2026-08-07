"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, BarChart3, Dumbbell, Library, TrendingUp, User } from "lucide-react";
import Link from "next/link";

const groupes = ["Pectoraux", "Épaules", "Dos", "Quadriceps", "Ischios/Fessiers", "Biceps", "Triceps", "Mollets", "Abdos"];
const equipements = ["salle", "halteres", "corps"] as const;
const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 },
  { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/progression", label: "Progression", icon: TrendingUp },
];

export default function BibliothequePage() {
  const supabase = createClient();
  const [exercices, setExercices] = useState<any[]>([]);
  const [filtreGroupe, setFiltreGroupe] = useState<string | null>(null);
  const [filtreEquip, setFiltreEquip] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const pathname = "/bibliotheque";

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
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh", backgroundColor: "var(--color-gymx-bg)" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="pt-1">
          <h1 className="card-title">Bibliothèque</h1>
          <p className="label">Exercices</p>
        </header>

        <div className="flex items-center gap-2 card px-3 py-2.5">
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un exercice…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ fontSize: "16px", color: "var(--color-gymx-text)", fontFamily: "var(--font-body)" }} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 overscroll-contain">
          <button onClick={() => setFiltreGroupe(null)}
            className={`shrink-0 px-3 py-2 rounded-full text-[10px] font-semibold border transition-colors touch-target ${
              !filtreGroupe ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted "
            }`}>Tous</button>
          {groupes.map((g) => (
            <button key={g} onClick={() => setFiltreGroupe(g === filtreGroupe ? null : g)}
              className={`shrink-0 px-3 py-2 rounded-full text-[10px] font-semibold border transition-colors touch-target  ${
                filtreGroupe === g ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted"
              }`}>{g}</button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {equipements.map((eq) => (
            <button key={eq} onClick={() => setFiltreEquip(eq === filtreEquip ? null : eq)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-colors touch-target  ${
                filtreEquip === eq ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted"
              }`}>
              {eq === "salle" ? "Salle" : eq === "halteres" ? "Haltères" : "Poids du corps"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement…</p>
          </div>
        ) : exercices.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Aucun exercice trouvé.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {exercices.map((exo: any) => (
              <div key={exo.id} className="card flex items-start gap-3 p-3">
                {exo.image_url ? (
                  <img src={exo.image_url} alt={exo.nom_fr} className="w-14 h-14 rounded-xl object-cover shrink-0" style={{ backgroundColor: "var(--color-gymx-bg)" }} loading="lazy" />
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--color-gymx-bg)" }}>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-muted)" }}>?</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[15px] text-gymx-text truncate" style={{ fontFamily: "var(--font-body)" }}>{exo.nom_fr}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-muted)" }}>{exo.groupe}</span>
                    <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>
                      {exo.equipement === "salle" ? "Salle" : exo.equipement === "halteres" ? "Haltères" : "Corps"}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-gymx-muted)" }}>
                    {exo.compound ? "Composé" : "Isolation"} · {exo.role === "principal" ? "Principal" : "Accessoire"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="sticky bottom-0  border-t px-2 py-1 flex justify-around items-center z-50"
        style={{ borderColor: "var(--color-gymx-border)", paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors touch-target"
              style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
              <item.icon className="w-5 h-5" style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }} />
              <span className="text-[10px] font-semibold tracking-[0.04em]" style={{ fontFamily: "var(--font-body)" }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
