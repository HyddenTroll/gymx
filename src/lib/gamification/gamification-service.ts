import { createClient } from "@/lib/supabase/client";
import { estimer1RM } from "@/lib/dashboard/dashboard-service";

const XP_SEANCE = 50;
const XP_RECORD = 100;

const NIVEAUX = [
  "Recrue", "Apprenti", "Soldat", "Combattant", "Vétéran",
  "Élite", "Maître", "Légende",
];

interface BadgeDef {
  id: string;
  label: string;
  desc: string;
  icone: string;
}

export const BADGES: BadgeDef[] = [
  { id: "premiere_seance", label: "Première séance", desc: "Termine ta première séance", icone: "🏁" },
  { id: "streak_3", label: "Régulier", desc: "3 séances d'affilée", icone: "🔥" },
  { id: "streak_7", label: "Assidu", desc: "7 séances d'affilée", icone: "🔥" },
  { id: "record", label: "Record", desc: "Bats un record personnel", icone: "🏆" },
  { id: "couverture", label: "Complet", desc: "Tous les muscles 2×/sem", icone: "💪" },
  { id: "volume_ideal", label: "Volume parfait", desc: "Tous les muscles dans le volume idéal", icone: "📊" },
  { id: "3_seances", label: "3×/semaine", desc: "3 séances dans la semaine", icone: "📅" },
  { id: "deload", label: "Sage", desc: "Exécute un deload", icone: "🧘" },
];

export function badgeIcon(id: string): string {
  return BADGES.find((b) => b.id === id)?.icone || "⭐";
}

export function badgeLabel(id: string): string {
  return BADGES.find((b) => b.id === id)?.label || id;
}

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
      quetes_en_cours: [],
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
  if (!g) return { niveauGagne: false, nouveauNiveau: 0 };

  const nouveauXP = g.xp + xp;
  const nouveauNiveau = g.niveau + Math.floor(nouveauXP / 100);
  const nouveauXPResiduel = nouveauXP % 100;
  const niveauGagne = nouveauNiveau > g.niveau;

  const badges = [...(g.badges || [])];
  if (niveauGagne) {
    for (let lvl = g.niveau + 1; lvl <= nouveauNiveau; lvl++) {
      const b = `niveau_${lvl}`;
      if (!badges.includes(b)) badges.push(b);
    }
  }

  await supabase
    .from("gamification")
    .update({
      xp: nouveauXPResiduel,
      niveau: nouveauNiveau,
      badges,
    })
    .eq("id", g.id);

  return { niveauGagne, nouveauNiveau };
}

export async function verifierRecords(
  userId: string,
  exerciceId: string,
  charge: number,
  reps: number
): Promise<boolean> {
  const supabase = createClient();
  if (!Number(charge) || !Number(reps)) return false;

  const rm = estimer1RM(Number(charge), Number(reps));

  const { data: series } = await supabase
    .from("series")
    .select("charge, reps, seance:seance_id!inner(user_id)")
    .eq("validee", true)
    .eq("exercice_id", exerciceId)
    .eq("seance.user_id", userId);

  if (!series || series.length === 0) return true;
  const meilleurRM = Math.max(...series.map((s: any) => estimer1RM(Number(s.charge), Number(s.reps))));
  return rm > meilleurRM;
}

export async function verifierQuetes(userId: string): Promise<{ badgeDecroche: string | null; xpGagne: number }> {
  const supabase = createClient();
  const { data: g } = await supabase
    .from("gamification")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!g) return { badgeDecroche: null, xpGagne: 0 };

  const badgesActuels = new Set(g.badges || []);
  let xpGagne = 0;
  let badgeDecroche: string | null = null;

  const decrocher = async (badgeId: string, xp: number) => {
    if (badgesActuels.has(badgeId)) return;
    badgesActuels.add(badgeId);
    badgeDecroche = badgeId;
    xpGagne += xp;
  };

  const today = new Date().toISOString().split("T")[0];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const { count: seancesTotal } = await supabase
    .from("seances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("terminee", true);

  if ((seancesTotal ?? 0) >= 1) await decrocher("premiere_seance", 100);

  const { data: seancesSemaine } = await supabase
    .from("seances")
    .select("date")
    .eq("user_id", userId)
    .eq("terminee", true)
    .gte("date", weekAgoStr)
    .lte("date", today);

  const datesSemaine = new Set((seancesSemaine || []).map((s: any) => s.date));
  if (datesSemaine.size >= 3) await decrocher("3_seances", 80);

  if (g.streak >= 3) await decrocher("streak_3", 50);
  if (g.streak >= 7) await decrocher("streak_7", 150);

  const { data: series } = await supabase
    .from("series")
    .select("exercice:exercice_id!inner(groupe)")
    .eq("validee", true)
    .gte("created_at", weekAgo.toISOString());

  if (series && series.length > 0) {
    const musclesTouches = new Set((series as any[]).map((s: any) => s.exercice?.groupe));
    const tousMuscles = ["Pectoraux", "Épaules", "Dos", "Quadriceps", "Ischios/Fessiers", "Biceps", "Triceps", "Mollets", "Abdos"];
    const couverts = tousMuscles.filter((m) => {
      const count = (series as any[]).filter((s: any) => s.exercice?.groupe === m).length;
      return count >= 2;
    });
    if (couverts.length >= 5) await decrocher("couverture", 150);
  }

  if (xpGagne > 0 || badgeDecroche) {
    const nouveauXP = g.xp + xpGagne;
    const nouveauNiveau = g.niveau + Math.floor(nouveauXP / 100);
    const badgesMisesAJour = [...badgesActuels];
    if (nouveauNiveau > g.niveau) {
      for (let lvl = g.niveau + 1; lvl <= nouveauNiveau; lvl++) {
        const b = `niveau_${lvl}`;
        if (!badgesMisesAJour.includes(b)) badgesMisesAJour.push(b);
      }
    }
    await supabase
      .from("gamification")
      .update({
        xp: nouveauXP % 100,
        niveau: nouveauNiveau,
        badges: badgesMisesAJour,
      })
      .eq("id", g.id);
  }

  return { badgeDecroche, xpGagne };
}

export function getNiveauLabel(niveau: number): string {
  return NIVEAUX[Math.min(niveau - 1, NIVEAUX.length - 1)] || "Légende";
}
