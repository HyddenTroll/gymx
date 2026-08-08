"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActivitesMois, ajouterActivite, supprimerActivite, getSeancesMois } from "@/lib/calendrier/calendrier-service";
import { BarChart3, Dumbbell, Library, TrendingUp, User, ChevronLeft, ChevronRight, Plus, X, Timer, Target, Bike, Waves, Activity } from "lucide-react";
import Link from "next/link";
import type { Activite } from "@/lib/calendrier/calendrier-service";

const navItems = [
  { href: "/qg", label: "QG", icon: BarChart3 }, { href: "/seance", label: "Séance", icon: Dumbbell },
  { href: "/calendrier", label: "Cal.", icon: BarChart3 },
  { href: "/bibliotheque", label: "Bibliothèque", icon: Library }, { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/profil", label: "Profil", icon: User },
];

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const TYPE_ICONES: Record<string, any> = { course: Timer, padel: Target, velo: Bike, natation: Waves, autre: Activity };
const TYPE_LABELS: Record<string, string> = { course: "Course", padel: "Padel", velo: "Vélo", natation: "Natation", autre: "Autre" };
const TYPE_UNITES: Record<string, { duree: string; distance: string }> = {
  course: { duree: "min", distance: "km" },
  padel: { duree: "min", distance: "" },
  velo: { duree: "min", distance: "km" },
  natation: { duree: "min", distance: "m" },
  autre: { duree: "min", distance: "" },
};

export default function CalendrierPage() {
  const supabase = createClient();
  const today = new Date();
  const [annee, setAnnee] = useState(today.getFullYear());
  const [mois, setMois] = useState(today.getMonth() + 1);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [seanceDates, setSeanceDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"course" | "padel" | "velo" | "natation" | "autre">("course");
  const [addDuree, setAddDuree] = useState("");
  const [addDistance, setAddDistance] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [message, setMessage] = useState("");
  const pathname = "/calendrier";

  const moisPrec = useCallback(() => {
    if (mois === 1) { setAnnee((a) => a - 1); setMois(12); }
    else setMois((m) => m - 1);
  }, [mois]);

  const moisSuiv = useCallback(() => {
    if (mois === 12) { setAnnee((a) => a + 1); setMois(1); }
    else setMois((m) => m + 1);
  }, [mois]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [act, dates] = await Promise.all([getActivitesMois(annee, mois), getSeancesMois(annee, mois)]);
      setActivites(act);
      setSeanceDates(dates);
      setLoading(false);
    })();
  }, [annee, mois]);

  const joursDansMois = new Date(annee, mois, 0).getDate();
  const premierJour = new Date(annee, mois - 1, 1).getDay();
  const decalage = premierJour === 0 ? 6 : premierJour - 1;

  const jours: (number | null)[] = [];
  for (let i = 0; i < decalage; i++) jours.push(null);
  for (let d = 1; d <= joursDansMois; d++) jours.push(d);
  while (jours.length % 7 !== 0) jours.push(null);

  const activitesParDate = new Map<string, Activite[]>();
  for (const a of activites) {
    if (!activitesParDate.has(a.date)) activitesParDate.set(a.date, []);
    activitesParDate.get(a.date)!.push(a);
  }

  const seanceSet = new Set(seanceDates);

  const dateStr = (d: number) => `${annee}-${String(mois).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const stats = {
    seances: seanceDates.length,
    activites: activites.length,
    heures: Math.round(activites.reduce((s, a) => s + (a.duree || 0), 0) / 60 * 10) / 10,
  };

  const ajouter = async () => {
    if (!selectedDate) return;
    const act = await ajouterActivite({
      date: selectedDate,
      type: addType,
      duree: addDuree ? Number(addDuree) : undefined,
      distance: addDistance ? Number(addDistance) : undefined,
      notes: addNotes || undefined,
    });
    if (act) {
      setActivites((prev) => [...prev, act]);
      setShowAdd(false);
      setAddDuree(""); setAddDistance(""); setAddNotes("");
      setMessage("Activité ajoutée");
    } else {
      setMessage("Erreur");
    }
    setTimeout(() => setMessage(""), 2000);
  };

  const supprimer = async (id: string) => {
    if (!confirm("Supprimer cette activité ?")) return;
    const ok = await supprimerActivite(id);
    if (ok) {
      setActivites((prev) => prev.filter((a) => a.id !== id));
      setMessage("Activité supprimée");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ minHeight: "100dvh" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--color-gymx-muted)" }}>Chargement…</p>
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col" style={{ minHeight: "100dvh" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4 safe-area-top">
        <header className="flex items-center justify-between">
          <h1 className="card-title">Calendrier</h1>
        </header>

        {message && (
          <div className="card p-3 text-sm font-semibold text-center animate-fade-in" style={{ color: "var(--color-gymx-accent)" }}>
            {message}
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={moisPrec} className="p-1.5 rounded-lg touch-target transition-colors" style={{ color: "var(--color-gymx-muted)" }}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-base" style={{ fontFamily: "var(--font-body)" }}>{MOIS[mois - 1]} {annee}</h2>
            <button onClick={moisSuiv} className="p-1.5 rounded-lg touch-target transition-colors" style={{ color: "var(--color-gymx-muted)" }}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center mb-3">
            {JOURS.map((j) => (
              <div key={j} className="text-[10px] font-semibold py-1" style={{ color: "var(--color-gymx-muted)" }}>{j}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {jours.map((d, i) => {
              if (d === null) return <div key={`e-${i}`} className="aspect-square" />;
              const ds = dateStr(d);
              const aAujourdhui = d === today.getDate() && mois === today.getMonth() + 1 && annee === today.getFullYear();
              const aActivites = activitesParDate.has(ds);
              const aSeance = seanceSet.has(ds);
              return (
                <button key={ds} onClick={() => { setSelectedDate(ds); setShowAdd(false); }}
                  className="aspect-square flex flex-col items-center justify-center rounded-lg touch-target transition-colors relative"
                  style={{
                    backgroundColor: aAujourdhui ? "var(--color-gymx-accent)" : "transparent",
                    color: aAujourdhui ? "#0a0a0b" : "var(--color-gymx-text)",
                    fontSize: "13px",
                    fontWeight: aAujourdhui ? 700 : 500,
                  }}>
                  <span>{d}</span>
                  <div className="flex gap-0.5 mt-0.5">
                    {aSeance && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-gymx-accent)" }} />}
                    {aActivites && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-gymx-muted)" }} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <div className="card flex-1 p-3 text-center">
            <span className="font-bold text-lg" style={{ color: "var(--color-gymx-accent)", fontFamily: "var(--font-mono)" }}>{stats.seances}</span>
            <p className="label text-[10px]">Séances</p>
          </div>
          <div className="card flex-1 p-3 text-center">
            <span className="font-bold text-lg" style={{ color: "var(--color-gymx-accent)", fontFamily: "var(--font-mono)" }}>{stats.activites}</span>
            <p className="label text-[10px]">Activités</p>
          </div>
          <div className="card flex-1 p-3 text-center">
            <span className="font-bold text-lg" style={{ color: "var(--color-gymx-accent)", fontFamily: "var(--font-mono)" }}>{stats.heures}h</span>
            <p className="label text-[10px]">Total</p>
          </div>
        </div>

        {selectedDate && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</h3>
              <div className="flex items-center gap-1">
                {seanceSet.has(selectedDate) && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "var(--color-gymx-accent)" }}>Séance</span>}
                <button onClick={() => setShowAdd(!showAdd)} className="p-1.5 rounded-lg touch-target transition-colors" style={{ color: "var(--color-gymx-accent)", backgroundColor: "rgba(245,158,11,0.1)" }}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showAdd && (
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--color-gymx-border)" }}>
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(TYPE_LABELS).map(([key, label]) => {
                    const Icon = TYPE_ICONES[key];
                    return (
                      <button key={key} onClick={() => setAddType(key as any)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold touch-target transition-colors"
                        style={{
                          backgroundColor: addType === key ? "var(--color-gymx-accent)" : "var(--color-gymx-border)",
                          color: addType === key ? "#0a0a0b" : "var(--color-gymx-muted)",
                        }}>
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--color-gymx-muted)" }}>Durée ({TYPE_UNITES[addType].duree})</p>
                    <input type="number" value={addDuree} onChange={(e) => setAddDuree(e.target.value)} placeholder="0"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      style={{ borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                  </div>
                  {TYPE_UNITES[addType].distance && (
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--color-gymx-muted)" }}>Distance ({TYPE_UNITES[addType].distance})</p>
                      <input type="number" value={addDistance} onChange={(e) => setAddDistance(e.target.value)} placeholder="0" step="0.1"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        style={{ borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                    </div>
                  )}
                </div>
                <input type="text" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Notes (optionnel)"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)" }} />
                <button onClick={ajouter} className="w-full py-2.5 rounded-lg text-xs font-semibold touch-target"
                  style={{ backgroundColor: "var(--color-gymx-accent)", color: "#0a0a0b" }}>
                  Ajouter
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              {(activitesParDate.get(selectedDate) || []).map((a) => {
                const Icon = TYPE_ICONES[a.type] || Activity;
                return (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-xl" style={{ backgroundColor: "var(--color-gymx-bg)" }}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
                      <div>
                        <span className="text-xs font-semibold" style={{ color: "var(--color-gymx-text)" }}>{TYPE_LABELS[a.type] || a.type}</span>
                        <div className="text-[10px]" style={{ color: "var(--color-gymx-muted)" }}>
                          {a.duree ? `${a.duree} min` : ""}
                          {a.distance ? ` · ${a.distance} ${TYPE_UNITES[a.type].distance}` : ""}
                          {a.notes ? ` · ${a.notes}` : ""}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => supprimer(a.id)} className="p-1 touch-target" style={{ color: "var(--color-gymx-muted)" }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {(activitesParDate.get(selectedDate) || []).length === 0 && !showAdd && (
                <p className="text-xs text-center py-3" style={{ color: "var(--color-gymx-muted)" }}>
                  Aucune activité ce jour. Tape + pour en ajouter.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <nav className="sticky bottom-0 border-t bg-gymx-surface px-2 py-1 flex justify-around items-center z-50"
        style={{ borderColor: "var(--color-gymx-border)", paddingBottom: "max(env(safe-area-inset-bottom, 4px), 4px)" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 py-2 px-2 transition-colors touch-target"
              style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }}>
              <item.icon className="w-5 h-5" style={{ color: active ? "var(--color-gymx-accent)" : "var(--color-gymx-muted)" }} />
              <span className="text-[9px] font-semibold tracking-[0.04em]" style={{ fontFamily: "var(--font-body)" }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
