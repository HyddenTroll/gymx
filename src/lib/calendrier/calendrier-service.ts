import { createClient } from "@/lib/supabase/client";

export interface Activite {
  id: string;
  user_id: string;
  date: string;
  type: "course" | "padel" | "velo" | "natation" | "autre";
  duree: number | null;
  distance: number | null;
  notes: string | null;
  created_at: string;
}

export async function getActivitesMois(annee: number, mois: number): Promise<Activite[]> {
  const supabase = createClient();
  const debut = `${annee}-${String(mois).padStart(2, "0")}-01`;
  const finDate = new Date(annee, mois, 0);
  const fin = `${annee}-${String(mois).padStart(2, "0")}-${String(finDate.getDate()).padStart(2, "0")}`;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("activites")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", debut)
    .lte("date", fin)
    .order("date", { ascending: true });

  return (data || []) as Activite[];
}

export async function getSeancesMois(annee: number, mois: number): Promise<string[]> {
  const supabase = createClient();
  const debut = `${annee}-${String(mois).padStart(2, "0")}-01`;
  const finDate = new Date(annee, mois, 0);
  const fin = `${annee}-${String(mois).padStart(2, "0")}-${String(finDate.getDate()).padStart(2, "0")}`;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("seances")
    .select("date")
    .eq("user_id", user.id)
    .eq("terminee", true)
    .gte("date", debut)
    .lte("date", fin);

  const dates: string[] = Array.from(new Set((data || []).map((s: any) => s.date)));
  return dates;
}

export async function ajouterActivite(activite: {
  date: string;
  type: "course" | "padel" | "velo" | "natation" | "autre";
  duree?: number;
  distance?: number;
  notes?: string;
}): Promise<Activite | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("activites")
    .insert({ user_id: user.id, ...activite })
    .select()
    .single();

  if (error) return null;
  return data as Activite;
}

export async function supprimerActivite(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("activites").delete().eq("id", id);
  return !error;
}
