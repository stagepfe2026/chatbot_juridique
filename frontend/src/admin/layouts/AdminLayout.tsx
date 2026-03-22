import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

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
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.08),_transparent_30%),#fbf5f6] text-slate-900">
      <div className="min-h-screen">

        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white/90">

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
                <div className="text-xs text-slate-500">Administration</div>
              </div>
            </div>
          </div>

          {/* Section title */}
          <div className="px-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                    : "text-slate-700 hover:bg-slate-100"
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
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon>
                <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </Icon>

              Documents
            </NavLink>

            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) =>
                `${linkBase} ${
                  isActive
                    ? "bg-red-600 text-white"
                    : "text-slate-700 hover:bg-slate-100"
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
              onClick={onLogout}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-red-50 hover:text-red-600 transition"
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




