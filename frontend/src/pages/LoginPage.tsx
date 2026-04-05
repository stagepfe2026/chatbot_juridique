import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import cimfLogo from "../assets/cimf-logo.svg";
import { useAuth } from "../auth/AuthContext";

function getHomePath(role: "ADMIN" | "FINANCE_USER"): string {
  return role === "ADMIN" ? "/admin/documents/import" : "/user/accueil";
}

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const features = [
  {
    title: "Questions en langage naturel",
    description: "Interrogez la base documentaire simplement",
    icon: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.2-4.2" />
      </>
    ),
  },
  {
    title: "Recherche avancée",
    description: "Filtres et recherche par mot-clé",
    icon: (
      <>
        <path d="M5 19V9" />
        <path d="M10 19V5" />
        <path d="M15 19v-7" />
        <path d="M20 19V3" />
      </>
    ),
  },
  {
    title: "Consultation de documents",
    description: "Lecture fluide des lois et décrets",
    icon: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5" />
        <path d="M10 13h6" />
        <path d="M10 17h6" />
      </>
    ),
  },
  {
    title: "Bibliothèque personnelle",
    description: "Créez vos favoris juridiques",
    icon: (
      <>
        <path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7z" />
        <path d="M7 5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h10" />
      </>
    ),
  },
];

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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#fff8f7_0%,#f6f7fb_100%)] px-4 py-4 sm:px-5 lg:px-6">
      <div className="login-grid-bg absolute inset-0 opacity-[0.58]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-[#ece9e7] bg-white/82 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-[1px]">
        <section className="flex w-full flex-col justify-center bg-white px-6 py-6 sm:px-8 lg:w-[47%] lg:px-10 lg:py-8">
          <div className="w-full max-w-[390px]">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-20 items-center justify-center">
                <img
                  src={cimfLogo}
                  alt="Logo CIMF"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <div className="text-[1.2rem] font-bold leading-none tracking-tight text-[#1f2937]">
                  CIMF
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">Portail Juridique</div>
              </div>
            </div>

            <div className="mt-7">
              <h1 className="text-[1.35rem] font-bold py-4 text-center tracking-tight text-[#0f172a] sm:text-[1.5rem]">
                Connexion
              </h1>

              <form className="mt-6 space-y-3.5" onSubmit={onSubmit}>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#475569]">
                    Adresse e-mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hatem_abidi@cimf.tn"
                    autoComplete="email"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#DA3D20] focus:ring-4 focus:ring-[rgba(218,61,32,0.18)]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#475569]">
                    Mot de passe
                  </span>
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 transition focus-within:border-[#DA3D20] focus-within:ring-4 focus-within:ring-[rgba(218,61,32,0.18)]">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      autoComplete="current-password"
                      className="w-full border-0 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? (
                        <Icon>
                          <path d="M3 3l18 18" />
                          <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
                          <path d="M9.36 5.56A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a13.17 13.17 0 0 1-4.16 4.91" />
                          <path d="M6.23 6.23A13.16 13.16 0 0 0 2 12s3 7 10 7a10.94 10.94 0 0 0 2.44-.28" />
                        </Icon>
                      ) : (
                        <Icon>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </Icon>
                      )}
                    </button>
                  </div>
                </label>

                {error ? (
                  <div className="rounded-xl border border-[rgba(218,61,32,0.28)] bg-[rgba(218,61,32,0.10)] px-4 py-2.5 text-[11px] font-semibold text-[#DA3D20]">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 h-11 w-full rounded-xl bg-[#DA3D20] text-xs font-bold text-white transition hover:translate-y-[-1px] hover:bg-[#C73519] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Connexion..." : "Se connecter"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="hidden border-l border-[#f1eeec] bg-gray-50 lg:flex lg:w-[53%] lg:flex-col lg:justify-center lg:px-9 lg:py-5">
          <div className="max-w-[420px]">
            <h2 className="text-[1.5rem] text-center font-bold leading-[1.08] tracking-tight text-[#0f172a]">
              Assistant Juridique
              <span className="text-[#DA3D20]"> Intelligent</span>
            </h2>
            <p className="mt-2.5 max-w-md py-4 text-sm leading-6 text-[#64748b]">
              Accédez à un assistant juridique basé sur des milliers de documents officiels pour vous aider dans vos recherches.
            </p>
          </div>

          <div className="mt-6  space-y-6">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#f2e9e7] bg-white text-[#DA3D20] shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                  <Icon size={15}>{feature.icon}</Icon>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#1e293b]">
                    {feature.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-5 text-[#94a3b8]">
                    {feature.description}
                  </div>
                </div>
              </div>
            ))}
          </div><br />

          <div className="mt-7 text-[11px] text-center text-[#94a3b8]">
            ©2026 • CIMF • Ministère des Finances
          </div>
        </section>
      </div>
    </div>
  );
}