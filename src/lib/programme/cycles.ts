import { createClient } from "@/lib/supabase/client";

export type Phase = "accumulation" | "intensification" | "deload";

export interface CycleInfo {
  phase: Phase;
  phaseSemaine: number; // 1-4 dans la phase
  phaseTotal: number; // 4
  cycleCourant: number;
  deloadDue: boolean;
  volumeCoeff: number; // multiplicateur du volume MAV
  intensiteNote: string;
}

function getPhase(cycle: number): Phase {
  const cycleDansBloc = ((cycle - 1) % 3) + 1;
  if (cycleDansBloc === 1) return "accumulation";
  if (cycleDansBloc === 2) return "intensification";
  return "deload";
}

function getVolumeCoeff(phase: Phase, phaseSemaine: number): number {
  if (phase === "accumulation") return 0.8 + (phaseSemaine - 1) * 0.07; // 80% → 100% MAV
  if (phase === "intensification") return 0.7 - (phaseSemaine - 1) * 0.1; // 70% → 40% MAV
  return 0.3; // deload
}

function getIntensiteNote(phase: Phase): string {
  if (phase === "accumulation") return "Volume haut · RPE 7-8";
  if (phase === "intensification") return "Charge lourde · RPE 8-9";
  return "Léger · RPE 5-6";
}

export async function verifierCycle(userId: string): Promise<CycleInfo> {
  const supabase = createClient();
  const { data: prog } = await supabase.from("programme_actif").select("*").eq("user_id", userId).single();
  if (!prog) {
    return {
      phase: "accumulation", phaseSemaine: 1, phaseTotal: 4,
      cycleCourant: 1, deloadDue: false, volumeCoeff: 0.8, intensiteNote: getIntensiteNote("accumulation"),
    };
  }

  const dateDebut = new Date(prog.date_debut);
  const aujourdHui = new Date();
  const joursEcoules = Math.floor((aujourdHui.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));
  const semaineGlobale = Math.max(1, Math.ceil(joursEcoules / 7) || 1);
  const cycle = prog.cycle_courant;
  const phase = getPhase(cycle);
  const phaseSemaine = Math.min(4, ((semaineGlobale - 1) % 4) + 1);
  const deloadDue = phase === "deload" || phaseSemaine === 4;

  return {
    phase,
    phaseSemaine,
    phaseTotal: 4,
    cycleCourant: cycle,
    deloadDue,
    volumeCoeff: getVolumeCoeff(phase, phaseSemaine),
    intensiteNote: getIntensiteNote(phase),
  };
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
      await supabase.from("charges").update({ charge_actuelle: chargeDeload, compteur_echecs: 0 }).eq("id", charge.id);
    }
    await supabase.from("programme_structure").update({
      series_cibles: Math.max(2, Math.round(s.series_cibles * 0.5)),
    }).eq("id", s.id);
  }

  return true;
}
