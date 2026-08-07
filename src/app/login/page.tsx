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
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 safe-area-top safe-area-bottom"
      style={{ minHeight: "100dvh" }}>
      <div className="w-full max-w-sm card p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display font-bold text-[28px] tracking-tight text-gymx-text"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
            GYMX
          </h1>
          <p className="text-sm text-gymx-muted">Carnet de musculation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="code" className="label">
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
              className="w-full border rounded-lg px-4 py-3 text-[16px] outline-none transition-colors"
              style={{ borderColor: "var(--color-gymx-border)", color: "var(--color-gymx-text)", backgroundColor: "var(--color-gymx-bg)" }}
              onFocus={(e) => e.target.style.borderColor = "var(--color-gymx-accent)"}
              onBlur={(e) => e.target.style.borderColor = "var(--color-gymx-border)"}
            />
          </div>

          {error && (
            <p className="text-xs text-center leading-relaxed" style={{ color: "var(--color-gymx-accent)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code}
            className="w-full font-semibold text-sm py-3.5 rounded-lg transition-colors disabled:opacity-30"
            style={{
              backgroundColor: loading || !code ? "var(--color-gymx-fill)" : "var(--color-gymx-fill-strong)",
              color: loading || !code ? "var(--color-gymx-muted)" : "var(--color-gymx-surface)",
              fontFamily: "var(--font-body)",
            }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="text-xs text-center leading-relaxed text-gymx-muted">
          Première fois&nbsp;? Connecte-toi pour créer ton compte.
        </p>
      </div>
    </div>
  );
}
