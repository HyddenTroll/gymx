"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ minHeight: "100dvh" }}>
          <div className="card w-full max-w-sm p-6 text-center space-y-3">
            <p className="text-2xl font-bold" style={{ color: "var(--color-gymx-accent)" }}>!</p>
            <p className="card-title">Une erreur est survenue</p>
            <p className="text-xs" style={{ color: "var(--color-gymx-muted)" }}>{this.state.error?.message || "Erreur inattendue"}</p>
            <button onClick={() => this.setState({ hasError: false, error: undefined })} className="btn-primary w-full">
              Réessayer
            </button>
            <Link href="/qg" className="block text-xs font-semibold mt-2" style={{ color: "var(--color-gymx-muted)" }}>
              Retour au QG
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
