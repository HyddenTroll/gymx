"use client";

import { useAuth } from "@/lib/supabase/auth";
import { useState, FormEvent } from "react";
import { Dumbbell } from "lucide-react";

export default function LoginPage() {
  const { signIn, loading, error } = useAuth();
  const [code, setCode] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await signIn(code);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 safe-area-top safe-area-bottom" style={{ minHeight: "100dvh" }}>
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))", border: "1px solid rgba(245,158,11,0.2)" }}>
            <Dumbbell className="w-7 h-7" style={{ color: "var(--color-gymx-accent)" }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-gymx-text)" }}>
            GYMX
          </h1>
          <p className="text-sm" style={{ color: "var(--color-gymx-muted)" }}>Connecte-toi pour continuer</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="label" htmlFor="code">Ton code</label>
            <input
              id="code"
              type="password"
              inputMode="text"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              className="input-field w-full"
            />
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: "var(--color-gymx-accent)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code}
            className="btn-primary w-full disabled:opacity-30"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-sm" style={{ color: "var(--color-gymx-muted)" }}>
          Première fois ? Connecte-toi pour créer ton compte.
        </p>
      </div>
    </div>
  );
}
