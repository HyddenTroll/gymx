"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "moi@gymx.local";

  const signIn = async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log("[auth] createClient...");
      const supabase = createClient();
      console.log("[auth] signInWithPassword...");
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: code,
      });
      console.log("[auth] signIn result:", { data, signInError });

      if (signInError) {
        console.log("[auth] signIn error:", signInError.message);
        if (signInError.message.includes("Invalid login credentials")) {
          console.log("[auth] trying signUp...");
          const { error: signUpError } = await supabase.auth.signUp({
            email: ADMIN_EMAIL,
            password: code,
            options: { data: { role: "owner" }, emailRedirectTo: undefined },
          });
          console.log("[auth] signUp result:", { signUpError });

          if (signUpError) {
            const msg = signUpError.message || "Erreur inconnue";
            console.log("[auth] signUp error:", msg);
            setError(msg);
            setLoading(false);
            return false;
          }
          console.log("[auth] signUp success, redirecting...");
        } else {
          const msg = signInError.message || "Erreur inconnue";
          console.log("[auth] other signin error:", msg);
          setError(msg);
          setLoading(false);
          return false;
        }
      }

      setLoading(false);

      const { count } = await supabase
        .from("profil")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data?.user?.id || "");

      const dejaConfigure = (count ?? 0) > 0;
      console.log("[auth] redirecting to", dejaConfigure ? "/qg" : "/onboarding");
      router.push(dejaConfigure ? "/qg" : "/onboarding");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur de connexion";
      console.log("[auth] catch:", msg, e);
      setError(msg);
      setLoading(false);
      return false;
    }
  };

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[auth] signout error:", e);
    }
    router.push("/login");
  };

  return { signIn, signOut, loading, error };
}
