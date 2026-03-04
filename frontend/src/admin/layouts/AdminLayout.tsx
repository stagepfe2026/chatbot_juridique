import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin-app">
      <div className="admin-shell">
        <header className="admin-header">
          <div className="header-left">
            <div className="header-icon">O</div>
            <div>
              <div className="admin-brand">Gestion Documentaire</div>
              <div className="user-status">
                Administration - {user?.prenom} {user?.nom}
              </div>
            </div>
          </div>
          <nav className="admin-nav">
            <NavLink
              to="/admin/documents"
              className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}
            >
              Documents
            </NavLink>
            <NavLink
              to="/admin/documents/import"
              className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}
            >
              Importer
            </NavLink>
            <NavLink
              to="/admin/conversations"
              className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}
            >
              Conversations
            </NavLink>
            <button type="button" className="admin-nav-link nav-button" onClick={onLogout}>
              Deconnexion
            </button>
          </nav>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
