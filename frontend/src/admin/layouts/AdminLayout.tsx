import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18" />
      <path d="M6 7h12" />
      <path d="M7 7l-3 6h6l-3-6z" />
      <path d="M17 7l-3 6h6l-3-6z" />
    </svg>
  );
}

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="admin-app">
      <div className="admin-shell jb-shell">
        <aside className="jb-sidebar">
          <div className="jb-sidebar-top">
            <div className="jb-logo" aria-hidden="true">
              <ScaleIcon />
            </div>
            <div>
              <div className="jb-brand-title">JurisBot</div>
              <div className="jb-brand-sub">Administration</div>
            </div>
          </div>

          <nav className="jb-sidebar-nav">
            <NavLink
              to="/admin/documents/import"
              className={({ isActive }) => `jb-sidebar-link${isActive ? " active" : ""}`}
            >
              <span className="jb-sidebar-ico" aria-hidden="true">
                <UploadIcon />
              </span>
              Importer
            </NavLink>
            <NavLink
              to="/admin/documents"
              end
              className={({ isActive }) => `jb-sidebar-link${isActive ? " active" : ""}`}
            >
              <span className="jb-sidebar-ico" aria-hidden="true">
                <FolderIcon />
              </span>
              Documents
            </NavLink>
          </nav>

          <div className="jb-sidebar-bottom">
            <button type="button" className="jb-sidebar-logout" onClick={onLogout}>
              <span className="jb-sidebar-ico" aria-hidden="true">
                <LogoutIcon />
              </span>
              Deconnexion
            </button>
          </div>
        </aside>

        <main className="admin-content jb-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
