import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      {children}
    </svg>
  );
}

const linkBase =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold no-underline transition";

export default function AdminLayout() {
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={isDark ? "min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.16),_transparent_36%),#0f172a] text-slate-100" : "min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.08),_transparent_30%),#fbf5f6] text-slate-900"}>
      <div className="min-h-screen">

        {/* Sidebar */}
        <aside className={isDark ? "fixed inset-y-0 left-0 z-20 flex w-64 flex-col overflow-y-auto border-r border-slate-700 bg-slate-900/95" : "fixed inset-y-0 left-0 z-20 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white/90"}>

          {/* Logo */}
          <div className="px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-red-600 text-white">
                <Icon>
                  <path d="M12 3v18" />
                  <path d="M6 7h12" />
                </Icon>
              </div>

              <div>
                <div className="text-sm font-bold tracking-tight">JurisBot</div>
                <div className={isDark ? "text-xs text-slate-400" : "text-xs text-slate-500"}>Administration</div>
              </div>
            </div>
          </div>

          {/* Section title */}
          <div className={isDark ? "px-6 text-xs font-semibold uppercase tracking-wide text-slate-500" : "px-6 text-xs font-semibold uppercase tracking-wide text-slate-400"}>
            Navigation
          </div>

          {/* Navigation */}
          <nav className="mt-2 px-3 flex flex-col gap-1">

            <NavLink
              to="/admin/documents/import"
              className={({ isActive }) =>
                `${linkBase} ${
                  isActive
                    ? "bg-red-600 text-white"
                    : isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon>
                <path d="M12 3v12" />
                <path d="M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </Icon>

              Importer
            </NavLink>

            <NavLink
              to="/admin/documents"
              end
              className={({ isActive }) =>
                `${linkBase} ${
                  isActive
                    ? "bg-red-600 text-white"
                    : isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon>
                <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </Icon>

              Documents
            </NavLink>

            <NavLink
              to="/admin/claims"
              className={({ isActive }) =>
                `${linkBase} ${
                  isActive
                    ? "bg-red-600 text-white"
                    : isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon>
                <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v7.4A2.8 2.8 0 0 1 17.2 16H9l-5 4V5.8z" />
                <path d="M12 8h.01" />
                <path d="M12 11.5v2.8" />
              </Icon>

              Reclamations
            </NavLink>

            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) =>
                `${linkBase} ${
                  isActive
                    ? "bg-red-600 text-white"
                    : isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon>
                <path d="M7 4h10" />
                <path d="M7 9h10" />
                <path d="M7 14h6" />
                <path d="M5 4h.01" />
                <path d="M5 9h.01" />
                <path d="M5 14h.01" />
              </Icon>

              Audit Logs
            </NavLink>

          </nav>

          {/* Logout */}
          <div className="mt-auto p-4">
            <button
              onClick={toggleTheme}
              className={isDark
                ? "mb-2 flex w-full items-center gap-3 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-amber-300 hover:text-amber-200"
                : "mb-2 flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              }
            >
              <Icon>
                {isDark ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.9 4.9 1.4 1.4" />
                    <path d="m17.7 17.7 1.4 1.4" />
                  </>
                ) : (
                  <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
                )}
              </Icon>
              {isDark ? "Soleil" : "Lune"}
            </button>

            <button
              onClick={onLogout}
              className={isDark
                ? "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 hover:text-red-200"
                : "flex items-center gap-3 w-full px-3 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition"
              }
            >
              <Icon>
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M21 3v18" />
              </Icon>

              Deconnexion
            </button>
          </div>

        </aside>

        {/* Main content */}
        <main className="ml-64 min-h-screen">
          <div className="p-6 lg:p-8">
          <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
}




