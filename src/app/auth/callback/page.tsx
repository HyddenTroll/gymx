"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push("/qg");
      } else {
        router.push("/login");
      }
    };
    handleAuth();
  }, [router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gymx-bg">
      <p className="text-gymx-muted font-display text-sm animate-pulse-glow">
        CONNEXION…
      </p>
    </div>
  );
}
