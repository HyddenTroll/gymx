import { createClient } from "@/lib/supabase/client";

/**
 * Vérifie si l'utilisateur a un profil et un programme actif
 */
export async function checkOnboardingComplete(): Promise<{
  profil: boolean;
  programme: boolean;
}> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profil: false, programme: false };

  const { count: profilCount } = await supabase
    .from("profil")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: progCount } = await supabase
    .from("programme_actif")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return {
    profil: (profilCount ?? 0) > 0,
    programme: (progCount ?? 0) > 0,
  };
}

/**
 * Récupère ou crée la séance du jour
 */
export async function getOrCreateSeanceDuJour(): Promise<{
  seance: any;
  exercices: any[];
  efforts: any[];
  nouvelle: boolean;
} | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: prog } = await supabase
    .from("programme_actif")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!prog) return null;

  const today = new Date().toISOString().split("T")[0];

  await supabase
    .from("seances")
    .update({ annulee: true })
    .eq("user_id", user.id)
    .eq("terminee", false)
    .eq("annulee", false)
    .lt("date", today);

  const { data: seanceExistante } = await supabase
    .from("seances")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .eq("terminee", false)
    .maybeSingle();

  if (seanceExistante) {
    const { data: series } = await supabase
      .from("series")
      .select("*")
      .eq("seance_id", seanceExistante.id)
      .order("ordre");

    const { data: efforts } = await supabase
      .from("effort")
      .select("*")
      .eq("seance_id", seanceExistante.id);

    return {
      seance: seanceExistante,
      exercices: series || [],
      efforts: efforts || [],
      nouvelle: false,
    };
  }

  const { data: lastSeance } = await supabase
    .from("seances")
    .select("jour_du_programme")
    .eq("user_id", user.id)
    .eq("terminee", true)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const jourDuProgramme = lastSeance
    ? (lastSeance.jour_du_programme % prog.jours_par_semaine) + 1
    : 1;

  const { data: newSeance, error } = await supabase
    .from("seances")
    .insert({
      user_id: user.id,
      date: today,
      jour_du_programme: jourDuProgramme,
    })
    .select()
    .single();

  if (error || !newSeance) return null;

  return {
    seance: newSeance,
    exercices: [],
    efforts: [],
    nouvelle: true,
  };
}
