import { createClient } from "@/lib/supabase/client";
import { estimer1RM } from "@/lib/dashboard/dashboard-service";

export interface Projection {
  exercice_id: string;
  nom: string;
  charge_actuelle: number;
  taux_hebdo: number;
  tendance: "hausse" | "stable" | "baisse";
  rpe_moyen: number;
  projection_4sem: number;
  projection_8sem: number;
  alerte_plateau: boolean;
  alerte_deload: boolean;
  objectif_charge?: number;
  semaines_restantes?: number;
}

export async function calculerProjections(userId: string): Promise<Projection[]> {
  const supabase = createClient();

  const { data: charges } = await supabase
    .from("charges")
    .select("*, exercice:exercice_id(id, nom_fr, groupe, role)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (!charges || charges.length === 0) return [];

  const { data: efforts } = await supabase
    .from("effort")
    .select("valeur, exercice_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: allCharges } = await supabase
    .from("charges")
    .select("*, exercice:exercice_id(nom_fr, groupe, role)")
    .eq("user_id", userId);

  const projections: Projection[] = [];

  for (const c of charges) {
    if (c.exercice?.role !== "principal") continue;
    if (!c.charge_actuelle || c.charge_actuelle <= 0) continue;

    const exoEfforts = (efforts || []).filter((e: any) => e.exercice_id === c.exercice_id);
    const rpeValues = exoEfforts.map((e: any) => e.valeur);
    const rpeMoyen = rpeValues.length > 0
      ? rpeValues.reduce((a: number, b: number) => a + b, 0) / rpeValues.length
      : 5;

    const chargeHistory = (allCharges || [])
      .filter((ch: any) => ch.exercice_id === c.exercice_id && ch.charge_actuelle > 0)
      .sort((a: any, b: any) => new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime());

    let tauxHebdo = 0;
    let tendance: "hausse" | "stable" | "baisse" = "stable";

    if (chargeHistory.length >= 2) {
      const first = chargeHistory[0];
      const last = chargeHistory[chargeHistory.length - 1];
      const chargeDiff = last.charge_actuelle - first.charge_actuelle;

      const firstDate = new Date(first.updated_at || first.created_at || new Date());
      const lastDate = new Date(last.updated_at || last.created_at || new Date());
      const weeksElapsed = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

      tauxHebdo = chargeDiff / weeksElapsed;

      const recent = chargeHistory.slice(-4);
      if (recent.length >= 3) {
        const recentDiffs = [];
        for (let i = 1; i < recent.length; i++) {
          recentDiffs.push(recent[i].charge_actuelle - recent[i-1].charge_actuelle);
        }
        const avgRecent = recentDiffs.reduce((a: number, b: number) => a + b, 0) / recentDiffs.length;
        if (avgRecent > tauxHebdo * 0.5) tendance = "hausse";
        else if (avgRecent < 0) tendance = "baisse";
        else tendance = "stable";
      }
    }

    let tauxAjuste = tauxHebdo;
    if (rpeMoyen >= 9) tauxAjuste *= 0.5;

    const recentEfforts = exoEfforts.slice(0, 3);
    const difficileCount = recentEfforts.filter((e: any) => e.valeur >= 9).length;
    const alertePlateau = tendance === "stable" && rpeMoyen >= 8;
    const alerteDeload = c.compteur_echecs >= 2;

    const projection4sem = c.charge_actuelle + tauxAjuste * 4;
    const projection8sem = c.charge_actuelle + tauxAjuste * 8;

    projections.push({
      exercice_id: c.exercice_id,
      nom: c.exercice?.nom_fr || "Exercice",
      charge_actuelle: c.charge_actuelle,
      taux_hebdo: Math.round(tauxAjuste * 10) / 10,
      tendance,
      rpe_moyen: Math.round(rpeMoyen * 10) / 10,
      projection_4sem: Math.round(projection4sem * 10) / 10,
      projection_8sem: Math.round(projection8sem * 10) / 10,
      alerte_plateau: alertePlateau,
      alerte_deload: alerteDeload,
    });
  }

  return projections.sort((a, b) => b.charge_actuelle - a.charge_actuelle);
}

export async function ajouterPoids(userId: string, poids: number): Promise<boolean> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase.from("poids_corps").upsert(
    { user_id: userId, date: today, poids },
    { onConflict: "user_id,date" }
  );
  return !error;
}

export async function mettreAJourProfil(userId: string, data: { niveau?: string; jours_par_semaine?: number; objectif?: string; materiel?: string }): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("profil").update(data).eq("user_id", userId);
  return !error;
}

export async function reintegrerExercice(userId: string, exerciceId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("exercices_exclus").delete().eq("user_id", userId).eq("exercice_id", exerciceId);
  return !error;
}
