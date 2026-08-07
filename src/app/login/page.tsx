"use client";

import { useAuth } from "@/lib/supabase/auth";
import { useState, FormEvent } from "react";


export default function LoginPage() {
  const { signIn, loading, error } = useAuth();
  const [code, setCode] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await signIn(code);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-gymx-bg">
      <div className="hud-panel w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-gymx-cyan hud-glow-cyan">
            GYMX
          </h1>
          <p className="text-gymx-muted text-sm">Carnet de musculation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm text-gymx-text block">
              Ton code
            </label>
            <input
              id="code"
              type="password"
              inputMode="text"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Entre ton code personnel"
              className="w-full bg-gymx-bg2 border border-gymx-border rounded-lg px-4 py-3 text-gymx-text placeholder-gymx-muted/50 focus:outline-none focus:border-gymx-cyan focus:hud-glow-cyan transition-all"
            />
          </div>

          {error && (
            <p className="text-gymx-magenta text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code}
            className="w-full bg-gymx-cyan/10 border border-gymx-cyan text-gymx-cyan font-display font-bold py-3 rounded-lg hud-glow-cyan hover:bg-gymx-cyan/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "CONNEXION…" : "CONNEXION"}
          </button>
        </form>

        <p className="text-gymx-muted text-xs text-center">
          Première fois&nbsp;? Connecte-toi pour créer ton compte.
        </p>
      </div>
    </div>
  );
}
