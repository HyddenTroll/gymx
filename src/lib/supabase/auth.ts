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
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: code,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: ADMIN_EMAIL,
            password: code,
            options: { data: { role: "owner" } },
          });

          if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return false;
          }
        } else {
          setError(signInError.message);
          setLoading(false);
          return false;
        }
      }

      setLoading(false);
      router.push("/onboarding");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de connexion");
      setLoading(false);
      return false;
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return { signIn, signOut, loading, error };
}
