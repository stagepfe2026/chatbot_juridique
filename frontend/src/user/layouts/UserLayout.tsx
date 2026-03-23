import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getFavoriteDocumentsCount } from "../../services/userDocuments.service";
import { useTheme } from "../../theme/ThemeContext";

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const navBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium no-underline transition duration-150";

export default function UserLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [favoriteCount, setFavoriteCount] = useState(0);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function refreshFavoritesCount() {
    try {
      const count = await getFavoriteDocumentsCount();
      setFavoriteCount(count);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshFavoritesCount();
  }, [location.pathname]);

  useEffect(() => {
    function onChanged() {
      void refreshFavoritesCount();
    }
    window.addEventListener("favorites-changed", onChanged);
    return () => window.removeEventListener("favorites-changed", onChanged);
  }, []);

  return (
    <div className={isDark ? "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_38%),linear-gradient(180deg,_#0f172a,_#111827)] text-slate-100" : "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.12),_transparent_35%),linear-gradient(180deg,_#fff8f8,_#f8fafc)] text-slate-900"}>
      <header className={isDark ? "sticky top-0 z-40 border-b border-slate-700/80 bg-slate-900/85 backdrop-blur-sm" : "sticky top-0 z-40 border-b border-white/50 bg-white/85 backdrop-blur-sm"}>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-500 text-xl font-black text-white shadow-[0_8px_16px_rgba(239,68,68,0.25)]">
              AJ
            </div>
            <div className="min-w-0">
              <div className={isDark ? "truncate text-xl font-bold tracking-tight text-slate-100" : "truncate text-xl font-bold tracking-tight text-slate-800"}>
                Assistant Juridique
              </div>
              <div className={isDark ? "truncate text-xs font-medium text-slate-400" : "truncate text-xs font-medium text-slate-500"}>
                Espace utilisateur - {user?.prenom} {user?.nom}
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink
              to="/user/accueil"
              className={({ isActive }) =>
                `${navBase} ${
                  isActive
                    ? "border-red-600 bg-red-600 text-white shadow-[0_8px_16px_rgba(239,68,68,0.2)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                }`
              }
            >
              <NavIcon>
                <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
              </NavIcon>
              Accueil
            </NavLink>

            <NavLink
              to="/user/recherche"
              className={({ isActive }) =>
                `${navBase} ${
                  isActive
                    ? "border-red-600 bg-red-600 text-white shadow-[0_8px_16px_rgba(239,68,68,0.2)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                }`
              }
            >
              <NavIcon>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4.2-4.2" />
              </NavIcon>
              Recherche
            </NavLink>

            <NavLink
              to="/user/chat"
              className={({ isActive }) =>
                `${navBase} ${
                  isActive
                    ? "border-red-600 bg-red-600 text-white shadow-[0_8px_16px_rgba(239,68,68,0.2)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                }`
              }
            >
              <NavIcon>
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </NavIcon>
              Chat
            </NavLink>
            <NavLink
              to="/user/favoris"
              className={({ isActive }) =>
                `${navBase} ${
                  isActive
                    ? "border-red-600 bg-red-600 text-white shadow-[0_8px_16px_rgba(239,68,68,0.2)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                }`
              }
            >
              <NavIcon>
                <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
              </NavIcon>
              Favoris
              {favoriteCount > 0 && (
                <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-current ring-1 ring-current/10">
                  {favoriteCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/user/reclamations"
              className={({ isActive }) =>
                `${navBase} ${
                  isActive
                    ? "border-red-600 bg-red-600 text-white shadow-[0_8px_16px_rgba(239,68,68,0.2)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                }`
              }
            >
              <NavIcon>
                <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v7.4A2.8 2.8 0 0 1 17.2 16H9l-5 4V5.8z" />
                <path d="M12 8h.01" />
                <path d="M12 11.5v2.8" />
              </NavIcon>
              Reclamations
            </NavLink>

            <NavLink
              to="/user/profil"
              className={({ isActive }) =>
                `${navBase} ${
                  isActive
                    ? "border-red-600 bg-red-600 text-white shadow-[0_8px_16px_rgba(239,68,68,0.2)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                }`
              }
            >
              <NavIcon>
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </NavIcon>
              Mon profil
            </NavLink>

            <button
              type="button"
              className={isDark
                ? "inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 transition duration-150 hover:border-amber-300 hover:text-amber-200"
                : "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition duration-150 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              }
              onClick={toggleTheme}
              aria-label="Changer de theme"
            >
              <NavIcon>
                {isDark ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.9 4.9 1.4 1.4" />
                    <path d="m17.7 17.7 1.4 1.4" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                  </>
                ) : (
                  <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
                )}
              </NavIcon>
              {isDark ? "Soleil" : "Lune"}
            </button>

            <button
              type="button"
              className={isDark
                ? "inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 no-underline transition duration-150 hover:border-red-300 hover:bg-slate-700 hover:text-red-200"
                : "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 no-underline transition duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              }
              onClick={onLogout}
            >
              <NavIcon>
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M21 3v18" />
              </NavIcon>
              Deconnexion
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-4 lg:px-6">
        <Outlet />
      </main>
    </div>
  );
}









