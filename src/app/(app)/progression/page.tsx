"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPoidsCorps, getForceMax } from "@/lib/dashboard/dashboard-service";
import { Trophy, Weight, BarChart3, Dumbbell, Library, TrendingUp, User, Clock, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 },
  { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library },
  { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/profil", label: "Profil", icon: User },
];

export default function ProgressionPage() {
  const supabase = createClient();
  const [poidsData, setPoidsData] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [seances, setSeances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSeries, setEditSeries] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const pathname = "/progression";

  useEffect(() => {
    (async () => {
      const [pc, fm] = await Promise.all([getPoidsCorps(), getForceMax()]);
      setPoidsData(pc); setRecords(fm);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("seances")
        .select("*, series(*), effort(*)")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(30);

      if (data) setSeances(data.filter((s: any) => s.terminee));
      setLoading(false);
    })();
  }, [supabase]);

  const formaterDuree = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}min${sec > 0 ? ` ${sec}s` : ""}`;
  };

  const startEdit = (seance: any) => {
    setEditingId(seance.id);
    setEditSeries(JSON.parse(JSON.stringify(seance.series)));
  };

  const updateEditSerie = (idx: number, field: string, value: number) => {
    setEditSeries((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: value };
      return n;
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    for (const serie of editSeries) {
      await supabase.from("series").update({ reps: serie.reps, charge: serie.charge }).eq("id", serie.id);
    }
    setSeances((prev) => prev.map((s) => {
      if (s.id === editingId) return { ...s, series: editSeries };
      return s;
    }));
    setEditingId(null);
    setMessage("Séance mise à jour");
    setTimeout(() => setMessage(""), 2000);
  };

  const deleteSeance = async (id: string) => {
    if (!confirm("Supprimer cette séance ?")) return;
    await supabase.from("effort").delete().eq("seance_id", id);
    await supabase.from("series").delete().eq("seance_id", id);
    await supabase.from("seances").delete().eq("id", id);
    setSeances((prev) => prev.filter((s) => s.id !== id));
    setMessage("Séance supprimée");
    setTimeout(() => setMessage(""), 2000);
  };

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ minHeight: "100dvh" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement…</p>
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="pt-1">
          <h1 className="card-title">Progression</h1>
          <p className="label">Poids du corps, records et séances passées</p>
        </header>

        {message && (
          <div className="card p-3 text-sm font-semibold text-center" style={{ color: "var(--color-gymx-accent)" }}>
            {message}
          </div>
        )}

        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Weight className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
            <p className="label">Poids du corps</p>
          </div>
          {poidsData.length === 0 ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-gymx-muted)" }}>
              Ajoute ton poids depuis le QG pour voir ta courbe.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="hero-value" style={{ fontSize: "2rem" }}>{poidsData[0].poids}</span>
                <span className="text-sm mb-1" style={{ color: "var(--color-gymx-muted)" }}>kg</span>
                {poidsData.length > 1 && (
                  <span className="text-xs mb-1 font-semibold" style={{ color: poidsData[0].poids >= poidsData[poidsData.length - 1].poids ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
                    {poidsData[0].poids >= poidsData[poidsData.length - 1].poids ? "+" : ""}
                    {(poidsData[0].poids - poidsData[poidsData.length - 1].poids).toFixed(1)} kg
                  </span>
                )}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {poidsData.slice(0, 15).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-0.5">
                    <span style={{ color: "var(--color-gymx-muted)" }}>{new Date(d.date).toLocaleDateString("fr-FR")}</span>
                    <span className="font-mono font-medium" style={{ color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }}>{d.poids} kg</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-accent)" }} />
            <p className="label">Records <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(PR)</span></p>
          </div>
          {records.length === 0 ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-gymx-muted)" }}>
              Tes records apparaîtront ici dès ta première séance loguée.
            </p>
          ) : (
            <div className="space-y-2">
              {records.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)", color: "var(--color-gymx-text)" }}>{r.nom}</span>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-gymx-muted)" }}>
                      Meilleure série&nbsp;: <span className="font-mono" style={{ fontFamily: "var(--font-mono)" }}>{r.charge} kg × {r.reps} reps</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="hero-value" style={{ fontSize: "1.5rem", color: "var(--color-gymx-accent)" }}>{r.rm}</span>
                    <span className="text-xs ml-1" style={{ color: "var(--color-gymx-muted)" }}>kg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
            <p className="label">Séances passées</p>
            <span className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>({seances.length})</span>
          </div>

          {seances.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>
                Termine ta première séance pour voir ton historique.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {seances.map((s: any) => {
                const isExpanded = expandedId === s.id;
                const isEditing = editingId === s.id;
                const rpeMoyen = s.effort?.length > 0
                  ? Math.round(s.effort.reduce((a: number, e: any) => a + e.valeur, 0) / s.effort.length * 10) / 10
                  : null;
                return (
                  <div key={s.id} className="card overflow-hidden">
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{new Date(s.date).toLocaleDateString("fr-FR")}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                            Jour {s.jour_du_programme}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {s.duree > 0 && <span className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>{formaterDuree(s.duree)}</span>}
                          {rpeMoyen && <span className="text-[10px] font-semibold" style={{ color: "var(--color-gymx-accent)" }}>RPE {rpeMoyen}</span>}
                          <button onClick={() => setExpandedId(isExpanded ? null : s.id)} className="p-1 touch-target">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>
                        {s.series?.length || 0} séries · {s.effort?.length || 0} exercices
                      </p>
                    </div>

                    {isExpanded && (
                      <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: "var(--color-gymx-border)" }}>
                        {isEditing ? (
                          <>
                            {editSeries.map((serie: any, idx: number) => (
                              <div key={serie.id || idx} className="flex items-center gap-2 text-xs py-1">
                                <span className="font-mono w-5 shrink-0" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>S{idx + 1}</span>
                                <input type="number" value={serie.reps}
                                  onChange={(e) => updateEditSerie(idx, "reps", Number(e.target.value) || 0)}
                                  className="w-14 border rounded-lg px-2 py-1 text-center"
                                  style={{ fontSize: "14px", borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                                <span style={{ color: "var(--color-gymx-muted)" }}>×</span>
                                <input type="number" value={serie.charge}
                                  onChange={(e) => updateEditSerie(idx, "charge", Number(e.target.value) || 0)}
                                  className="w-16 border rounded-lg px-2 py-1 text-center"
                                  style={{ fontSize: "14px", borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                                <span style={{ color: "var(--color-gymx-muted)" }}>{serie.unite || "kg"}</span>
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setEditingId(null)}
                                className="flex-1 py-2 rounded-lg text-xs font-semibold touch-target"
                                style={{ border: "1px solid var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                                Annuler
                              </button>
                              <button onClick={saveEdit}
                                className="flex-1 py-2 rounded-lg text-xs font-semibold touch-target"
                                style={{ backgroundColor: "var(--color-gymx-accent)", color: "#0a0a0b" }}>
                                <Save className="w-3 h-3 inline mr-1" />Sauvegarder
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-1">
                              {(s.series || []).map((serie: any, idx: number) => (
                                <div key={serie.id || idx} className="flex items-center gap-2 text-xs py-0.5">
                                  <span className="font-mono w-5 shrink-0" style={{ color: "var(--color-gymx-muted)", fontFamily: "var(--font-mono)" }}>S{idx + 1}</span>
                                  <span className="font-mono font-medium" style={{ fontFamily: "var(--font-mono)", color: "var(--color-gymx-text)" }}>
                                    {serie.charge || 0}
                                  </span>
                                  <span style={{ color: "var(--color-gymx-muted)" }}>{serie.unite || "kg"} × {serie.reps}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => deleteSeance(s.id)}
                                className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold touch-target"
                                style={{ border: "1px solid var(--color-gymx-border)", color: "var(--color-gymx-muted)" }}>
                                <Trash2 className="w-3 h-3" /> Supprimer
                              </button>
                              <button onClick={() => startEdit(s)}
                                className="flex items-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold touch-target"
                                style={{ backgroundColor: "var(--color-gymx-fill)", color: "var(--color-gymx-text)" }}>
                                Modifier
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <nav className="sticky bottom-0 border-t bg-gymx-surface px-2 py-1 flex justify-around items-center z-50"
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
