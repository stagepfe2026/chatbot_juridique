import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="admin-app">
      <div className="admin-shell">
        <header className="admin-header">
          <div className="admin-brand">Gestion Documentaire</div>
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
          </nav>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
