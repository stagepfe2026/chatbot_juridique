import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function getHomePath(role: "ADMIN" | "FINANCE_USER"): string {
  return role === "ADMIN" ? "/admin/documents" : "/user/accueil";
}

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5">
      {children}
    </svg>
  );
}

const backgroundCircles = [
  { size: 180, top: "8%", left: "6%", delay: "0s", duration: "10s", opacity: 0.5 },
  { size: 260, top: "14%", left: "70%", delay: "1.4s", duration: "13s", opacity: 0.38 },
  { size: 220, top: "52%", left: "12%", delay: "0.8s", duration: "11.5s", opacity: 0.42 },
  { size: 300, top: "58%", left: "62%", delay: "2.2s", duration: "14s", opacity: 0.32 },
  { size: 160, top: "30%", left: "42%", delay: "1.8s", duration: "9.5s", opacity: 0.45 },
];

function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {backgroundCircles.map((circle, index) => (
        <div
          key={index}
          className="absolute rounded-full bg-red-500/70 blur-[2px] animate-drift-page"
          style={{
            width: `${circle.size}px`,
            height: `${circle.size}px`,
            top: circle.top,
            left: circle.left,
            opacity: circle.opacity,
            animationDelay: circle.delay,
            animationDuration: circle.duration,
          }}
        />
      ))}
    </div>
  );
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.08),_transparent_40%),linear-gradient(180deg,_#fff6f6,_#f8fafc)] px-4 [perspective:1400px]">
      <AnimatedBackground />
      <div className="absolute inset-0 z-[1] bg-white/28" />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-white/30 bg-white/88 p-6 shadow-lg backdrop-blur-md sm:p-8">
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">Connexion</h2>
          <p className="text-center text-sm text-slate-500">
            Accedez a votre espace documentaire et au chatbot juridique
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Adresse e-mail</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-400 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-100">
              <Icon size={16}>
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <path d="m4 8 8 6 8-6" />
              </Icon>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Mot de passe</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-400 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-100">
              <Icon size={16}>
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </Icon>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? (
                  <Icon size={16}>
                    <path d="M3 3l18 18" />
                    <path d="M9.8 9.8A3 3 0 0 0 14.2 14.2" />
                  </Icon>
                ) : (
                  <Icon size={16}>
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </Icon>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <label className="inline-flex items-center gap-2 font-medium">
              <input className="h-3 w-3 rounded border-slate-300 text-red-600 focus:ring-red-200" type="checkbox" />
              Se souvenir de moi
            </label>
            <button type="button" className="font-semibold text-red-600 hover:text-red-700">
              Mot de passe oublie ?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          {error && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
        </form>
      </div>

      <style>
        {`
          @keyframes drift-page {
            0% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1); }
            20% { transform: translate3d(90px, -55px, 120px) rotateX(8deg) rotateY(-10deg) scale(1.08); }
            40% { transform: translate3d(-130px, 60px, -90px) rotateX(-6deg) rotateY(12deg) scale(0.94); }
            60% { transform: translate3d(120px, 30px, 150px) rotateX(10deg) rotateY(6deg) scale(1.06); }
            80% { transform: translate3d(-70px, -75px, -110px) rotateX(-8deg) rotateY(-8deg) scale(0.98); }
            100% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1); }
          }
          .animate-drift-page {
            animation: drift-page ease-in-out infinite;
            transform-style: preserve-3d;
            will-change: transform;
          }
        `}
      </style>
    </div>
  );
}



