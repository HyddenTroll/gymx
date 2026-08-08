"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getVideoUrl } from "@/lib/exercices/videos";
import { Search, BarChart3, Dumbbell, Library, TrendingUp, User, X, Calendar } from "lucide-react";
import Link from "next/link";

const groupes = ["Pectoraux", "Epaules", "Dos", "Quadriceps", "Ischios/Fessiers", "Biceps", "Triceps", "Mollets", "Abdos"];
const equipements = ["salle", "halteres", "corps"] as const;
const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 }, { href: "/seance", label: "Seance", icon: Dumbbell },
  { href: "/calendrier", label: "Cal.", icon: Calendar },
  { href: "/bibliotheque", label: "Bibliotheque", icon: Library }, { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/profil", label: "Profil", icon: User },
];

export default function BibliothequePage() {
  const supabase = createClient();
  const [exercices, setExercices] = useState<any[]>([]);
  const [filtreGroupe, setFiltreGroupe] = useState<string | null>(null);
  const [filtreEquip, setFiltreEquip] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailExo, setDetailExo] = useState<any>(null);
  const [exoStats, setExoStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
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

  const openDetail = async (exo: any) => {
    setDetailExo(exo);
    setStatsLoading(true);
    setExoStats(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: series } = await supabase
        .from("series")
        .select("*, seance:seance_id(date, duree)")
        .eq("exercice_id", exo.id)
        .eq("validee", true)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: efforts } = await supabase
        .from("effort")
        .select("valeur, cran, seance:seance_id(date)")
        .eq("exercice_id", exo.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: charge } = await supabase
        .from("charges")
        .select("*")
        .eq("user_id", user.id)
        .eq("exercice_id", exo.id)
        .maybeSingle();

      const meilleureSerie = (series || []).reduce((best: any, s: any) => {
        const rm = Number(s.charge) * (1 + Number(s.reps) / 30);
        return !best || rm > best.rm ? { ...s, rm } : best;
      }, null);

      setExoStats({
        series: series || [],
        efforts: efforts || [],
        charge: charge || null,
        meilleureSerie,
        nbSeances: new Set((series || []).map((s: any) => s.seance_id)).size,
      });
    }
    setStatsLoading(false);
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="pt-1">
          <h1 className="card-title">Bibliotheque</h1>
          <p className="label">Exercices</p>
        </header>

        <div className="flex items-center gap-2 card px-3 py-2.5">
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un exercice..." className="flex-1 bg-transparent text-sm outline-none"
            style={{ fontSize: "16px", color: "var(--color-gymx-text)" }} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 overscroll-contain">
          <button onClick={() => setFiltreGroupe(null)}
            className={"shrink-0 px-3 py-2 rounded-full text-[10px] font-semibold border transition-colors touch-target " + (!filtreGroupe ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted")}>Tous</button>
          {groupes.map((g) => (
            <button key={g} onClick={() => setFiltreGroupe(g === filtreGroupe ? null : g)}
              className={"shrink-0 px-3 py-2 rounded-full text-[10px] font-semibold border transition-colors touch-target " + (filtreGroupe === g ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted")}>{g}</button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {equipements.map((eq) => (
            <button key={eq} onClick={() => setFiltreEquip(eq === filtreEquip ? null : eq)}
              className={"flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-colors touch-target " + (filtreEquip === eq ? "border-gymx-accent text-gymx-accent" : "border-gymx-border text-gymx-muted")}>
              {eq === "salle" ? "Salle" : eq === "halteres" ? "Halteres" : "Poids du corps"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement...</p></div>
        ) : exercices.length === 0 ? (
          <div className="card p-6 text-center"><p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Aucun exercice trouve.</p></div>
        ) : (
          <div className="space-y-2">
            {exercices.map((exo: any) => (
              <button key={exo.id} onClick={() => openDetail(exo)}
                className="w-full card flex items-start gap-3 p-3 text-left active:scale-[0.98] transition-all touch-target">
                {exo.image_url ? (
                  <img src={exo.image_url} alt={exo.nom_fr} className="w-14 h-14 rounded-xl object-cover shrink-0" loading="lazy" />
                ) : (
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--color-gymx-bg)" }}>
                    <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-muted)" }}>?</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[15px] text-gymx-text truncate">{exo.nom_fr}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-muted)" }}>{exo.groupe}</span>
                    <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{exo.equipement === "salle" ? "Salle" : exo.equipement === "halteres" ? "Halteres" : "Corps"}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-gymx-muted)" }}>{exo.compound ? "Compose" : "Isolation"} · {exo.role === "principal" ? "Principal" : "Accessoire"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {detailExo && (
        <div className="fixed inset-0 z-50 flex flex-col safe-area-top safe-area-bottom" style={{ backgroundColor: "var(--color-gymx-bg)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-gymx-border)" }}>
            <button onClick={() => setDetailExo(null)} className="p-2 -ml-2 touch-target">
              <X className="w-5 h-5" style={{ color: "var(--color-gymx-text)" }} />
            </button>
            <h2 className="card-title text-center flex-1 truncate px-2">{detailExo.nom_fr}</h2>
            <div className="w-9" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {getVideoUrl(detailExo.slug) && (
              <div className="mt-4 card overflow-hidden">
                <div className="aspect-video">
                  <iframe src={getVideoUrl(detailExo.slug) || ""} className="w-full h-full" allowFullScreen title="Tutoriel" />
                </div>
              </div>
            )}

            <div className="card p-4 space-y-2">
              <p className="label">Informations</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>Groupe</span><p className="font-semibold">{detailExo.groupe}</p></div>
                <div><span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>Sous-region</span><p className="font-semibold">{detailExo.sous_region}</p></div>
                <div><span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>Type</span><p className="font-semibold">{detailExo.compound ? "Compose" : "Isolation"}</p></div>
                <div><span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>Role</span><p className="font-semibold">{detailExo.role === "principal" ? "Principal" : "Accessoire"}</p></div>
                <div><span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>Equipement</span><p className="font-semibold">{detailExo.equipement === "salle" ? "Salle" : detailExo.equipement === "halteres" ? "Halteres" : "Corps"}</p></div>
                <div><span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>Unite</span><p className="font-semibold">{detailExo.unite_par_defaut}</p></div>
              </div>
            </div>

            {detailExo.instructions && detailExo.instructions.length > 0 && (
              <div className="card p-4 space-y-2">
                <p className="label">Instructions</p>
                <ol className="space-y-1">
                  {detailExo.instructions.map((inst: string, i: number) => (
                    <li key={i} className="text-xs flex gap-2 leading-relaxed">
                      <span className="font-semibold shrink-0" style={{ color: "var(--color-gymx-accent)" }}>{i + 1}.</span>
                      <span style={{ color: "var(--color-gymx-muted)" }}>{inst}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {statsLoading ? (
              <div className="card p-6 text-center"><p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Chargement des stats...</p></div>
            ) : exoStats ? (
              <div className="card p-4 space-y-3">
                <p className="label">Mes stats</p>

                {exoStats.charge && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--color-gymx-muted)" }}>Charge actuelle</span>
                    <span className="font-mono font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{exoStats.charge.charge_actuelle} {exoStats.charge.unite}</span>
                  </div>
                )}

                {exoStats.meilleureSerie && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--color-gymx-muted)" }}>Meilleure serie</span>
                    <span className="font-mono font-semibold" style={{ color: "var(--color-gymx-accent)", fontFamily: "var(--font-mono)" }}>
                      {exoStats.meilleureSerie.charge} kg x {exoStats.meilleureSerie.reps} reps
                    </span>
                  </div>
                )}

                {exoStats.meilleureSerie && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "var(--color-gymx-muted)" }}>Force max estimee (1RM)</span>
                    <span className="font-mono font-semibold" style={{ color: "var(--color-gymx-accent)", fontFamily: "var(--font-mono)" }}>
                      {Math.round(exoStats.meilleureSerie.rm)} kg
                    </span>
                  </div>
                )}

                <p className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{exoStats.nbSeances} seances · {exoStats.series.length} series</p>

                {exoStats.efforts.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Derniers efforts (RPE)</p>
                    {exoStats.efforts.slice(0, 5).map((e: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span style={{ color: "var(--color-gymx-muted)" }}>{new Date(e.seance?.date).toLocaleDateString("fr-FR") || "—"}</span>
                        <span className="font-mono font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{e.valeur}/10 · {e.cran}</span>
                      </div>
                    ))}
                  </div>
                )}

                {exoStats.series.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Dernieres series</p>
                    {exoStats.series.slice(0, 10).map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span style={{ color: "var(--color-gymx-muted)" }}>{new Date(s.seance?.date).toLocaleDateString("fr-FR") || "—"}</span>
                        <span className="font-mono font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{s.charge} {s.unite || "kg"} x {s.reps}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-6 text-center">
                <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Aucune donnee pour cet exercice. Commence une seance pour voir tes stats ici.</p>
              </div>
            )}

            {getVideoUrl(detailExo.slug) && (
              <a href={getVideoUrl(detailExo.slug)!.replace("/embed/", "/watch?v=")} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold touch-target"
                style={{ backgroundColor: "#FF0000", color: "#fff" }}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> Voir sur YouTube
              </a>
            )}
          </div>
        </div>
      )}

      <nav className="sticky bottom-0 border-t bg-gymx-surface px-2 py-1 flex justify-around items-center z-50"
        style={{ borderColor: "var(--color-gymx-border)", paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors touch-target"
              style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
              <item.icon className="w-5 h-5" style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }} />
              <span className="text-[10px] font-semibold tracking-[0.04em]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
