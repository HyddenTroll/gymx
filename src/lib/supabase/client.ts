import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let client: any = null;

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL et clé anon requises dans .env.local");
  }

  client = createSupabaseClient(supabaseUrl, supabaseKey);
  return client;
}
