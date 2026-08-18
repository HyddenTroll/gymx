"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActivitesMois, ajouterActivite, supprimerActivite, getSeancesMois } from "@/lib/calendrier/calendrier-service";
import { ChevronLeft, ChevronRight, Plus, X, Timer, Target, Bike, Waves, Activity } from "lucide-react";
import type { Activite } from "@/lib/calendrier/calendrier-service";

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

export default function CalendrierWidget({ refreshKey }: { refreshKey?: number }) {
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
      try {
        const [act, dates] = await Promise.all([getActivitesMois(annee, mois), getSeancesMois(annee, mois)]);
        setActivites(act);
        setSeanceDates(dates);
      } catch {
        setMessage("Impossible de charger le calendrier");
      }
      setLoading(false);
    })();
  }, [annee, mois, refreshKey]);

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

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="label">Calendrier</p>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-gymx-muted)" }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-gymx-accent)" }} /> Séance</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-gymx-muted)" }} /> Activité</span>
        </div>
      </div>

      {message && (
        <p className="text-xs font-semibold animate-fade-in" style={{ color: "var(--color-gymx-accent)" }}>{message}</p>
      )}

      <div className="flex items-center justify-between">
        <button onClick={moisPrec} className="p-1 rounded-lg touch-target" style={{ color: "var(--color-gymx-muted)" }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-sm">{MOIS[mois - 1]} {annee}</span>
        <button onClick={moisSuiv} className="p-1 rounded-lg touch-target" style={{ color: "var(--color-gymx-muted)" }}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {JOURS.map((j) => (
          <div key={j} className="text-[9px] font-semibold py-0.5" style={{ color: "var(--color-gymx-muted)" }}>{j}</div>
        ))}
        {jours.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} className="aspect-square" />;
          const ds = dateStr(d);
          const estAujourdhui = d === today.getDate() && mois === today.getMonth() + 1 && annee === today.getFullYear();
          const aActivites = activitesParDate.has(ds);
          const aSeance = seanceSet.has(ds);
          return (
            <button key={ds} onClick={() => { setSelectedDate(ds); setShowAdd(false); }}
              className="aspect-square flex flex-col items-center justify-center rounded-md touch-target relative text-xs"
              style={{
                minWidth: 0,
                minHeight: 0,
                backgroundColor: estAujourdhui ? "var(--color-gymx-accent)" : "transparent",
                color: estAujourdhui ? "#0a0a0b" : "var(--color-gymx-text)",
                fontWeight: estAujourdhui ? 700 : 500,
              }}>
              <span>{d}</span>
              <div className="flex gap-0.5 mt-0.5">
                {aSeance && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: "var(--color-gymx-accent)" }} />}
                {aActivites && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: "var(--color-gymx-muted)" }} />}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--color-gymx-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <div className="flex items-center gap-1">
              {seanceSet.has(selectedDate) && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "var(--color-gymx-accent)" }}>Séance</span>}
              <button onClick={() => setShowAdd(!showAdd)} className="p-1 rounded-md touch-target" style={{ color: "var(--color-gymx-accent)" }}>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="space-y-2">
              <div className="flex gap-1 flex-wrap">
                {Object.entries(TYPE_LABELS).map(([key, label]) => {
                  const Icon = TYPE_ICONES[key];
                  return (
                    <button key={key} onClick={() => setAddType(key as any)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold touch-target"
                      style={{
                        backgroundColor: addType === key ? "var(--color-gymx-accent)" : "var(--color-gymx-border)",
                        color: addType === key ? "#0a0a0b" : "var(--color-gymx-muted)",
                      }}>
                      <Icon className="w-3 h-3" /> {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input type="number" value={addDuree} onChange={(e) => setAddDuree(e.target.value)} placeholder={`Durée (${TYPE_UNITES[addType].duree})`}
                  className="flex-1 border rounded-lg px-2 py-1.5 text-xs" style={{ borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                {TYPE_UNITES[addType].distance && (
                  <input type="number" value={addDistance} onChange={(e) => setAddDistance(e.target.value)} placeholder={`Distance (${TYPE_UNITES[addType].distance})`} step="0.1"
                    className="flex-1 border rounded-lg px-2 py-1.5 text-xs" style={{ borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)", fontFamily: "var(--font-mono)" }} />
                )}
              </div>
              <input type="text" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Notes"
                className="w-full border rounded-lg px-2 py-1.5 text-xs" style={{ borderColor: "var(--color-gymx-border)", backgroundColor: "var(--color-gymx-bg)", color: "var(--color-gymx-text)" }} />
              <button onClick={ajouter} className="w-full py-2 rounded-lg text-xs font-semibold touch-target"
                style={{ backgroundColor: "var(--color-gymx-accent)", color: "#0a0a0b" }}>
                Ajouter
              </button>
            </div>
          )}

          <div className="space-y-1">
            {(activitesParDate.get(selectedDate) || []).map((a) => {
              const Icon = TYPE_ICONES[a.type] || Activity;
              return (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: "var(--color-gymx-bg)" }}>
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-gymx-muted)" }} />
                    <div>
                      <span className="text-[11px] font-semibold" style={{ color: "var(--color-gymx-text)" }}>{TYPE_LABELS[a.type]}</span>
                      <span className="text-[10px] ml-1" style={{ color: "var(--color-gymx-muted)" }}>
                        {a.duree ? `${a.duree} min` : ""}{a.distance ? ` · ${a.distance} ${TYPE_UNITES[a.type].distance}` : ""}{a.notes ? ` · ${a.notes}` : ""}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => supprimer(a.id)} className="p-0.5 touch-target" style={{ color: "var(--color-gymx-muted)" }}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {(activitesParDate.get(selectedDate) || []).length === 0 && !showAdd && (
              <p className="text-[10px] text-center py-2" style={{ color: "var(--color-gymx-muted)" }}>
                Aucune activité. Tape + pour ajouter.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
