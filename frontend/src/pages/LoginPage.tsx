import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { ReactNode } from "react";

function getHomePath(role: "ADMIN" | "FINANCE_USER"): string {
  return role === "ADMIN" ? "/admin/documents" : "/user/chat";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from =
    typeof location.state === "object" && location.state && "from" in location.state
      ? String((location.state as { from?: unknown }).from ?? "")
      : "";

  function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {children}
      </svg>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email et mot de passe sont obligatoires.");
      return;
    }

    try {
      setLoading(true);
      const res = await login({ email, password });
      const fallback = getHomePath(res.user.role);
      const target = from.startsWith("/") ? from : fallback;
      navigate(target, { replace: true });
    } catch {
      setError("Identifiants invalides.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card modern-login-card">
        <div className="login-brand-row">
          <div className="login-brand-icon">
            <Icon size={16}>
              <path d="M8 3h6l4 4v14H6V3z" />
              <path d="M14 3v4h4" />
            </Icon>
          </div>
          <div className="login-brand-name">Assistant Juridique</div>
        </div>

        <h1 className="login-title">Bienvenue</h1>
        <p className="login-subtitle">Connectez-vous pour continuer</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <div className="login-field-shell">
            <span className="login-field-icon">
              <Icon size={16}>
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <path d="m4 8 8 6 8-6" />
              </Icon>
            </span>
            <input
              id="email"
              className="input login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="prenom.nom@entreprise.com"
            />
          </div>

          <label className="field-label" htmlFor="password">
            Mot de passe
          </label>
          <div className="login-field-shell">
            <span className="login-field-icon">
              <Icon size={16}>
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </Icon>
            </span>
            <input
              id="password"
              className="input login-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
            />
            <button
              type="button"
              className="login-ghost-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? (
                <Icon size={16}>
                  <path d="M3 3l18 18" />
                  <path d="M9.8 9.8A3 3 0 0 0 14.2 14.2" />
                  <path d="M6.6 6.6A11.8 11.8 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4" />
                  <path d="M10.9 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a13.3 13.3 0 0 1-2.5 3.4" />
                </Icon>
              ) : (
                <Icon size={16}>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </Icon>
              )}
            </button>
          </div>

          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        {error && <div className="message-error">{error}</div>}
      </div>
    </div>
  );
}
