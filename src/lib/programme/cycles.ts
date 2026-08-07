import { createClient } from "@/lib/supabase/client";

export async function verifierCycle(userId: string): Promise<{
  finDeBloc: boolean;
  semaine: number;
  total: number;
  deloadDue: boolean;
}> {
  const supabase = createClient();
  const { data: prog } = await supabase.from("programme_actif").select("*").eq("user_id", userId).single();
  if (!prog) return { finDeBloc: false, semaine: 0, total: 0, deloadDue: false };

  const dateDebut = new Date(prog.date_debut);
  const aujourdHui = new Date();
  const joursEcoules = Math.floor((aujourdHui.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));
  const semaineCalculee = Math.min(Math.ceil(joursEcoules / 7) || 1, prog.longueur_bloc);

  const finDeBloc = semaineCalculee > prog.longueur_bloc;
  const deloadDue = semaineCalculee >= 4 && semaineCalculee % 4 === 0;

  return { finDeBloc, semaine: prog.semaine_courante, total: prog.longueur_bloc, deloadDue };
}

export async function incrementerSemaine(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: prog } = await supabase.from("programme_actif").select("*").eq("user_id", userId).single();
  if (!prog) return false;

  const nouvelleSemaine = prog.semaine_courante + 1;
  const nouveauCycle = nouvelleSemaine > prog.longueur_bloc ? prog.cycle_courant + 1 : prog.cycle_courant;

  await supabase.from("programme_actif").update({
    semaine_courante: nouvelleSemaine > prog.longueur_bloc ? 1 : nouvelleSemaine,
    cycle_courant: nouveauCycle,
  }).eq("id", prog.id);

  return true;
}

export async function executerDeload(userId: string): Promise<boolean> {
  const supabase = createClient();

  const { data: prog } = await supabase.from("programme_actif").select("*").eq("user_id", userId).single();
  if (!prog) return false;

  const { data: structures } = await supabase.from("programme_structure")
    .select("*").eq("programme_actif_id", prog.id);

  if (!structures) return false;

  for (const s of structures) {
    const { data: charge } = await supabase.from("charges")
      .select("*").eq("user_id", userId).eq("exercice_id", s.exercice_id).single();
    if (charge) {
      const chargeDeload = Math.round(charge.charge_actuelle * 0.6 / charge.pas) * charge.pas;
      await supabase.from("charges").update({
        charge_actuelle: chargeDeload,
        compteur_echecs: 0,
      }).eq("id", charge.id);
    }
    await supabase.from("programme_structure").update({
      series_cibles: Math.max(2, Math.round(s.series_cibles * 0.5)),
    }).eq("id", s.id);
  }

  return true;
}
