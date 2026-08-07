import { createClient } from "@/lib/supabase/client";
import { estimer1RM } from "@/lib/dashboard/dashboard-service";

export interface Projection {
  exercice_id: string;
  nom: string;
  charge_actuelle: number;
  taux_hebdo: number;
  taux_ema: number; // Exponential Moving Average rate
  tendance: "hausse" | "stable" | "baisse";
  rpe_moyen: number;
  projection_4sem: number;
  projection_8sem: number;
  proj_optimiste: number; // best case (75th percentile)
  proj_pessimiste: number; // worst case (25th percentile)
  alerte_plateau: boolean;
  alerte_deload: boolean;
  objectif_charge?: number;
  semaines_restantes?: number;
  fiabilite: "elevee" | "moyenne" | "faible";
}

/** EMA: lisse les variations, donne plus de poids au recent */
function ema(values: number[], alpha: number = 0.3): number {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}

function ecartType(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sq, n) => sq + (n - mean) ** 2, 0) / (values.length - 1));
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
    let tauxEMA = 0;
    let tendance: "hausse" | "stable" | "baisse" = "stable";
    let fiabilite: "elevee" | "moyenne" | "faible" = "faible";

    if (chargeHistory.length >= 2) {
      const increments: number[] = [];
      const dates: Date[] = [];

      for (let i = 1; i < chargeHistory.length; i++) {
        const diff = chargeHistory[i].charge_actuelle - chargeHistory[i - 1].charge_actuelle;
        const daysBetween = (new Date(chargeHistory[i].updated_at || chargeHistory[i].created_at || new Date()).getTime()
          - new Date(chargeHistory[i - 1].updated_at || chargeHistory[i - 1].created_at || new Date()).getTime())
          / (24 * 60 * 60 * 1000);
        if (daysBetween > 0) {
          increments.push(diff / (daysBetween / 7));
        }
      }

      if (increments.length > 0) {
        tauxHebdo = increments.reduce((a, b) => a + b, 0) / increments.length;
        tauxEMA = ema(increments, 0.4);

        const recent = increments.slice(-3);
        const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
        if (avgRecent > tauxEMA * 0.3) tendance = "hausse";
        else if (avgRecent < -0.5) tendance = "baisse";
        else tendance = "stable";

        const std = ecartType(increments);
        if (increments.length >= 5 && std < tauxHebdo * 0.5) fiabilite = "elevee";
        else if (increments.length >= 3) fiabilite = "moyenne";
      }
    }

    let tauxAjuste = tauxEMA > 0 ? tauxEMA : tauxHebdo;
    if (rpeMoyen >= 9) tauxAjuste *= 0.5;

    const recentEfforts = rpeValues.slice(0, 3);
    const alertePlateau = tendance === "stable" && rpeMoyen >= 8;
    const alerteDeload = c.compteur_echecs >= 2 || (rpeMoyen >= 9 && rpeValues.length >= 2);

    // Courbe logarithmique : progression rapide au debut, puis ralentit
    const logCurve = (sem: number) => c.charge_actuelle + tauxAjuste * 4 * Math.log(sem + 1) / Math.log(5);
    const projection4sem = Math.max(0, logCurve(4));
    const projection8sem = Math.max(0, logCurve(8));

    // Intervalles de confiance : ± 1 écart-type sur les projections
    const incrementsStd = chargeHistory.length >= 2
      ? ecartType(chargeHistory.slice(1).map((ch: any, i: number) => ch.charge_actuelle - chargeHistory[i].charge_actuelle))
      : tauxAjuste;
    const marge = Math.max(incrementsStd * 2, 2.5);
    const projOptimiste = projection8sem + marge;
    const projPessimiste = Math.max(0, projection8sem - marge);

    projections.push({
      exercice_id: c.exercice_id,
      nom: c.exercice?.nom_fr || "Exercice",
      charge_actuelle: c.charge_actuelle,
      taux_hebdo: Math.round(tauxHebdo * 10) / 10,
      taux_ema: Math.round(tauxEMA * 10) / 10,
      tendance,
      rpe_moyen: Math.round(rpeMoyen * 10) / 10,
      projection_4sem: Math.round(projection4sem * 10) / 10,
      projection_8sem: Math.round(projection8sem * 10) / 10,
      proj_optimiste: Math.round(projOptimiste * 10) / 10,
      proj_pessimiste: Math.round(projPessimiste * 10) / 10,
      alerte_plateau: alertePlateau,
      alerte_deload: alerteDeload,
      fiabilite,
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
