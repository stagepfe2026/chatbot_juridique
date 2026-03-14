import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getFavoriteDocumentsCount } from "../../services/userDocuments.service";

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [favoriteCount, setFavoriteCount] = useState(0);

  const isChatRoute = location.pathname.startsWith("/user/chat");

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
    // refresh on route change to keep badge in sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    function onChanged() {
      void refreshFavoritesCount();
    }
    window.addEventListener("favorites-changed", onChanged);
    return () => window.removeEventListener("favorites-changed", onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`user-app${isChatRoute ? " user-app--chat" : ""}`}>
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
              <span className="nav-ico" aria-hidden="true">
                <NavIcon>
                  <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
                </NavIcon>
              </span>
              Accueil
            </NavLink>

            <NavLink to="/user/recherche" className={({ isActive }) => `user-nav-link${isActive ? " active" : ""}`}>
              <span className="nav-ico" aria-hidden="true">
                <NavIcon>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4.2-4.2" />
                </NavIcon>
              </span>
              Recherche
            </NavLink>

            <NavLink to="/user/chat" className={({ isActive }) => `user-nav-link${isActive ? " active" : ""}`}>
              <span className="nav-ico" aria-hidden="true">
                <NavIcon>
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                </NavIcon>
              </span>
              Chat
            </NavLink>

            <NavLink to="/user/favoris" className={({ isActive }) => `user-nav-link user-nav-link--fav${isActive ? " active" : ""}`}>
              <span className="nav-ico" aria-hidden="true">
                <NavIcon>
                  <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
                </NavIcon>
              </span>
              Favoris
              {favoriteCount > 0 && <span className="nav-badge">{favoriteCount}</span>}
            </NavLink>

            <button type="button" className="user-nav-link nav-button" onClick={onLogout}>
              <span className="nav-ico" aria-hidden="true">
                <NavIcon>
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                  <path d="M21 3v18" />
                </NavIcon>
              </span>
              Deconnexion
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
