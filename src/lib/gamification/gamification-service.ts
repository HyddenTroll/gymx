import { createClient } from "@/lib/supabase/client";

const XP_SEANCE_TERMINEE = 50;
const XP_VOLUME_IDEAL = 30;
const XP_RECORD = 100;

const NIVEAUX = [
  "Recrue", "Apprenti", "Soldat", "Combattant", "Vétéran",
  "Élite", "Maître", "Légende",
];

export async function initialiserGamification(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("gamification")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    await supabase.from("gamification").insert({
      user_id: userId,
      xp: 0,
      niveau: 1,
      streak: 0,
      badges: [],
      quetes_en_cours: JSON.stringify([
        { id: "premiere_seance", label: "Première séance terminée", faite: false, xp: 100 },
        { id: "couverture", label: "Tous les muscles 2× cette semaine", faite: false, xp: 150 },
      ]),
    });
  }
}

export async function ajouterXP(
  userId: string,
  xp: number,
  raison: string
) {
  const supabase = createClient();
  const { data: g } = await supabase
    .from("gamification")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!g) return;

  const nouveauXP = g.xp + xp;
  const nouveauNiveau = g.niveau + Math.floor(nouveauXP / 100);
  const nouveauXPResiduel = nouveauXP % 100;

  const badges = [...(g.badges || [])];
  if (nouveauNiveau > g.niveau) {
    badges.push(`niveau_${nouveauNiveau}`);
  }

  await supabase
    .from("gamification")
    .update({
      xp: nouveauXPResiduel,
      niveau: nouveauNiveau,
      badges,
      quetes_en_cours: g.quetes_en_cours,
    })
    .eq("id", g.id);
}

export async function verifierRecords(
  userId: string,
  exerciceId: string,
  charge: number,
  reps: number
): Promise<boolean> {
  const supabase = createClient();
  const charge_num = Number(charge);
  const reps_num = Number(reps);
  if (!charge_num || !reps_num) return false;

  const rm = charge_num * (1 + reps_num / 30);

  const { data: meilleur } = await supabase
    .from("series")
    .select("charge, reps")
    .eq("validee", true)
    .eq("exercice_id", exerciceId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!meilleur || meilleur.length === 0) return true;

  const meilleurRM = Number(meilleur[0].charge) * (1 + Number(meilleur[0].reps) / 30);
  return rm > meilleurRM;
}
