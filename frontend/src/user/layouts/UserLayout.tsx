import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 3h6l4 4v14H6V3z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6" />
    </svg>
  );
}

export default function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isChatPage = location.pathname.startsWith("/user/chat");
  const isSearchPage = location.pathname.startsWith("/user/recherche");
  const isFavoritesPage = location.pathname.startsWith("/user/favoris");
  const isHomePage = location.pathname.startsWith("/user/accueil");

  function getPageTitle() {
    if (isChatPage) return "Assistant Juridique";
    if (isSearchPage) return "Recherche juridique";
    if (isFavoritesPage) return "Favoris";
    if (isHomePage) return "Accueil";
    return "Espace utilisateur";
  }

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="user-app">
      <div className="user-shell">
        <header className="user-header">
          <div className="header-left">
            <div className="header-icon">AJ</div>
            <div>
              <div className="user-brand">Assistant Juridique</div>
              <div className="user-status">
                Espace utilisateur - {user?.prenom} {user?.nom}
              </div>
            </div>
          </div>

          <nav className="user-nav">
            <NavLink to="/user/accueil" className={({ isActive }) => `user-nav-link${isActive ? " active" : ""}`}>
              Accueil
            </NavLink>
            <NavLink to="/user/recherche" className={({ isActive }) => `user-nav-link${isActive ? " active" : ""}`}>
              Recherche
            </NavLink>
            <NavLink to="/user/favoris" className={({ isActive }) => `user-nav-link${isActive ? " active" : ""}`}>
              Favoris
            </NavLink>
            <NavLink to="/user/chat" className={({ isActive }) => `user-nav-link${isActive ? " active" : ""}`}>
              Chat
            </NavLink>
            <button type="button" className="user-nav-link nav-button" onClick={onLogout}>
              Déconnexion
            </button>
          </nav>
        </header>

   

        <main className="user-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}