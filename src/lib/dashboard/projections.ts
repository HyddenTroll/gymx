import { createClient } from "@/lib/supabase/client";

export interface ProgressionSimple {
  exercice_id: string;
  nom: string;
  charge_actuelle: number;
  charge_precedente: number;
  delta: number;
  moyenne_hebdo: number;
  rpe_moyen: number;
  historique: { charge: number; date: string }[];
  alerte_plateau: boolean;
  alerte_deload: boolean;
}

export async function calculerProgression(userId: string): Promise<ProgressionSimple[]> {
  const supabase = createClient();

  const { data: charges } = await supabase
    .from("charges")
    .select("*, exercice:exercice_id(id, nom_fr, groupe, role)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (!charges || charges.length === 0) return [];

  const { data: efforts } = await supabase
    .from("effort")
    .select("valeur, exercice_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: allCharges } = await supabase
    .from("charges")
    .select("*, exercice:exercice_id(nom_fr, groupe, role)")
    .eq("user_id", userId);

  const resultats: ProgressionSimple[] = [];

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

    let charge_precedente = 0;
    let moyenne_hebdo = 0;
    let alerte_plateau = false;
    let alerte_deload = false;

    const historique: { charge: number; date: string }[] = chargeHistory.map((ch: any) => ({
      charge: ch.charge_actuelle,
      date: (ch.updated_at || ch.created_at || "").split("T")[0],
    }));

    if (chargeHistory.length >= 2) {
      charge_precedente = chargeHistory[chargeHistory.length - 2].charge_actuelle;

      const first = chargeHistory[0];
      const last = chargeHistory[chargeHistory.length - 1];
      const deltaTotal = last.charge_actuelle - first.charge_actuelle;
      const joursTotal = Math.max(1,
        (new Date(last.updated_at || last.created_at || "").getTime()
         - new Date(first.updated_at || first.created_at || "").getTime())
        / (24 * 60 * 60 * 1000)
      );
      moyenne_hebdo = Math.round((deltaTotal / (joursTotal / 7)) * 10) / 10;

      alerte_plateau = rpeMoyen >= 8 && moyenne_hebdo <= 0.5;
      alerte_deload = c.compteur_echecs >= 2 || (rpeMoyen >= 9 && rpeValues.length >= 2);
    }

    resultats.push({
      exercice_id: c.exercice_id,
      nom: c.exercice?.nom_fr || "Exercice",
      charge_actuelle: c.charge_actuelle,
      charge_precedente,
      delta: Math.round((c.charge_actuelle - charge_precedente) * 10) / 10,
      moyenne_hebdo,
      rpe_moyen: Math.round(rpeMoyen * 10) / 10,
      historique: historique.slice(-8),
      alerte_plateau,
      alerte_deload,
    });
  }

  return resultats.sort((a, b) => b.charge_actuelle - a.charge_actuelle);
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
