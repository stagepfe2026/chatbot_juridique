import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTheme } from "../../theme/ThemeContext";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      {children}
    </svg>
  );
}

const navItemBase =
  "group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium no-underline transition";

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const sidebarClass = isDark
    ? "fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-slate-800 bg-slate-950 text-slate-100"
    : "fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-[#efe5e1] bg-[#fcf9f8] text-[#2b2523]";

  const navIdleClass = isDark
    ? "text-slate-300 hover:bg-slate-900"
    : "text-[#4e4541] hover:bg-[#f8efeb]";

  const navActiveClass = isDark
    ? "bg-slate-900 text-white"
    : "bg-[#f9e9e2] text-[#DA3D20]";

  const fullName = `${user?.prenom ?? ""} ${user?.nom ?? ""}`.trim() || "Utilisateur";
  const initials = `${user?.prenom?.trim().charAt(0) ?? ""}${user?.nom?.trim().charAt(0) ?? ""}`.toUpperCase() || "US";
  const roleLabel = user?.role === "ADMIN" ? "Admin" : "Utilisateur";

  return (
    <div className={isDark ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-[#f8f4f3] text-[#1f1b1a]"}>
      <div className="min-h-screen">
        {/* Sidebar */}
        <aside className={sidebarClass}>
          {/* Brand */}
          <div className="px-5 pb-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DA3D20] text-white shadow-sm">
                <Icon>
                  <path d="M12 21s-6-4.35-8.5-8A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 20.5 13C18 16.65 12 21 12 21z" />
                </Icon>
              </div>

              <div>
                <div className="text-lg font-semibold leading-none tracking-tight">JurisBot</div>
                <div
                  className={
                    isDark
                      ? "mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500"
                      : "mt-1 text-[10px] uppercase tracking-[0.18em] text-[#a0928c]"
                  }
                >
                  Administration
                </div>
              </div>
            </div>
          </div>

          {/* Section */}
          <div
            className={
              isDark
                ? "px-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                : "px-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b1a39d]"
            }
          >
            Overview
          </div>

          {/* Navigation */}
          <nav className="mt-3 flex flex-col gap-0.5 px-3 [&_a]:no-underline">
            <NavLink
              to="/admin/documents/import"
              className={({ isActive }) =>
                `${navItemBase} ${isActive ? navActiveClass : navIdleClass}`
              }
            >
              <Icon>
                <path d="M12 3v12" />
                <path d="M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </Icon>
              <span>Importer</span>
            </NavLink>

            <NavLink
              to="/admin/documents"
              end
              className={({ isActive }) =>
                `${navItemBase} ${isActive ? navActiveClass : navIdleClass}`
              }
            >
              <Icon>
                <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </Icon>
              <span>Documents</span>
            </NavLink>

            <NavLink
              to="/admin/claims"
              className={({ isActive }) =>
                `${navItemBase} ${isActive ? navActiveClass : navIdleClass}`
              }
            >
              <Icon>
                <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v7.4A2.8 2.8 0 0 1 17.2 16H9l-5 4V5.8z" />
                <path d="M12 8h.01" />
                <path d="M12 11.5v2.8" />
              </Icon>
              <span>Réclamations</span>
            </NavLink>

            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) =>
                `${navItemBase} ${isActive ? navActiveClass : navIdleClass}`
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
              <span>Audit Logs</span>
            </NavLink>
          </nav>

          {/* Footer area */}
          <div className="mt-auto border-t border-[#efe5e1] px-4 py-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DA3D20] text-sm font-semibold text-white">
                  {initials}
                </div>

                <div className="leading-tight">
                  <div className="text-sm font-semibold">{fullName}</div>
                  <div className={isDark ? "text-[11px] text-slate-400" : "text-[11px] text-[#8b7d78]"}>
                    {roleLabel}
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className={
                  isDark
                    ? "flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-900 hover:text-red-400"
                    : "flex h-9 w-9 items-center justify-center rounded-lg text-[#6b5f5a] transition hover:bg-[#fff1ec] hover:text-[#DA3D20]"
                }
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                  <path d="M21 3v18" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="ml-[260px] min-h-screen">
          {/* Top bar */}
          <div
            className={
              isDark
                ? "sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur"
                : "sticky top-0 z-20 border-b border-[#efe5e1] bg-[#f8f4f3]/90 backdrop-blur"
            }
          ></div>

          {/* Content */}
          <div className="px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
