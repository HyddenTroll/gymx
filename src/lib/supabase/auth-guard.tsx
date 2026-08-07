"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthed(true);
      } else if (pathname !== "/login" && pathname !== "/auth/callback") {
        router.push("/login");
        return;
      }
      setChecking(false);
    };
    check();
  }, [pathname, router]);

  if (checking && !authed && pathname !== "/login" && pathname !== "/auth/callback") {
    return (
      <div className="min-h-dvh bg-gymx-bg flex items-center justify-center">
        <p className="font-display text-sm text-gymx-muted animate-pulse-glow">CHARGEMENT…</p>
      </div>
    );
  }

  return <>{children}</>;
}
