import { createClient } from "@/lib/supabase/client";

export async function getPushPullRatio(userId: string): Promise<{ pushPct: number; pullPct: number; ratio: number; equilibre: boolean }> {
  const supabase = createClient();
  const { data } = await supabase.from("series").select("exercice:exercice_id!inner(groupe)")
    .eq("validee", true);

  if (!data || data.length === 0) return { pushPct: 0, pullPct: 0, ratio: 1, equilibre: true };

  const groupesPush = ["Pectoraux", "Épaules", "Triceps"];
  const groupesPull = ["Dos", "Biceps", "Ischios/Fessiers"];

  let push = 0, pull = 0;
  for (const s of data as any[]) {
    const g = s.exercice?.groupe || "";
    if (groupesPush.includes(g)) push++;
    if (groupesPull.includes(g)) pull++;
  }

  const total = push + pull;
  const pushPct = total > 0 ? Math.round((push / total) * 100) : 50;
  const pullPct = total > 0 ? Math.round((pull / total) * 100) : 50;
  const ratio = pull > 0 ? Math.round((push / pull) * 10) / 10 : 1;
  const equilibre = ratio >= 0.7 && ratio <= 1.5;

  return { pushPct, pullPct, ratio, equilibre };
}

export async function getIntensiteDistribution(userId: string): Promise<{ facile: number; moyen: number; dur: number; impossible: number }> {
  const supabase = createClient();
  const { data } = await supabase.from("effort").select("valeur").eq("user_id", userId);

  if (!data || data.length === 0) return { facile: 0, moyen: 0, dur: 0, impossible: 0 };

  const total = data.length;
  const facile = Math.round((data.filter((e: any) => e.valeur <= 4).length / total) * 100);
  const moyen = Math.round((data.filter((e: any) => e.valeur >= 5 && e.valeur <= 7).length / total) * 100);
  const dur = Math.round((data.filter((e: any) => e.valeur >= 8 && e.valeur <= 9).length / total) * 100);
  const impossible = Math.round((data.filter((e: any) => e.valeur === 10).length / total) * 100);

  return { facile, moyen, dur, impossible };
}

export async function getPointsFaibles(userId: string): Promise<{ sous_region: string; sets: number }[]> {
  const supabase = createClient();
  const semaineDerniere = new Date();
  semaineDerniere.setDate(semaineDerniere.getDate() - 14);

  const { data } = await supabase
    .from("series")
    .select("exercice:exercice_id!inner(sous_region)")
    .eq("validee", true)
    .gte("created_at", semaineDerniere.toISOString());

  if (!data) return [];

  const compteur = new Map<string, number>();
  for (const s of data as any[]) {
    const region = s.exercice?.sous_region;
    if (region) compteur.set(region, (compteur.get(region) || 0) + 1);
  }

  const toutesRegions = [
    "pecs_haut", "pecs_milieu_bas", "epaules_anterieur", "epaules_lateral", "epaules_posterieur",
    "dos_largeur", "dos_epaisseur", "trapezes", "ischios_flexion", "ischios_hanche",
    "quads_squat", "quads_isolation", "biceps", "triceps", "mollets", "abdos",
  ];

  return toutesRegions
    .map((r) => ({ sous_region: r, sets: compteur.get(r) || 0 }))
    .filter((r) => r.sets < 6)
    .sort((a, b) => a.sets - b.sets);
}

const LABELS: Record<string, string> = {
  pecs_haut: "Pectoraux haut", pecs_milieu_bas: "Pectoraux milieu/bas",
  epaules_anterieur: "Épaules ant.", epaules_lateral: "Épaules lat.", epaules_posterieur: "Épaules post.",
  dos_largeur: "Dos largeur", dos_epaisseur: "Dos épaisseur", trapezes: "Trapèzes",
  ischios_flexion: "Ischios flexion", ischios_hanche: "Ischios hanche",
  quads_squat: "Quadriceps squat", quads_isolation: "Quadriceps isolation",
  biceps: "Biceps", triceps: "Triceps", mollets: "Mollets", abdos: "Abdominaux",
};

export function labelSousRegion(slug: string): string {
  return LABELS[slug] || slug;
}
