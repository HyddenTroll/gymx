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
      style={{ minHeight: "100dvh", backgroundColor: "#F1F1EF" }}>
      <div className="w-full max-w-sm card p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display font-bold text-[28px] tracking-tight text-gymx-text"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
            GYMX
          </h1>
          <p className="text-sm" style={{ color: "#6B6D72" }}>Carnet de musculation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="code" className="text-xs font-semibold tracking-[0.08em] uppercase"
              style={{ color: "#6B6D72" }}>
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
              style={{ borderColor: "#E2E2DE", color: "#17181A", backgroundColor: "#F1F1EF" }}
              onFocus={(e) => e.target.style.borderColor = "#E4002B"}
              onBlur={(e) => e.target.style.borderColor = "#E2E2DE"}
            />
          </div>

          {error && (
            <p className="text-xs text-center leading-relaxed" style={{ color: "#E4002B" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code}
            className="w-full font-semibold text-sm py-3.5 rounded-lg transition-colors disabled:opacity-30"
            style={{
              backgroundColor: loading || !code ? "#D9D9D4" : "#17181A",
              color: loading || !code ? "#6B6D72" : "#FFFFFF",
              fontFamily: "var(--font-body)",
            }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="text-xs text-center leading-relaxed" style={{ color: "#6B6D72" }}>
          Première fois&nbsp;? Connecte-toi pour créer ton compte.
        </p>
      </div>
    </div>
  );
}
