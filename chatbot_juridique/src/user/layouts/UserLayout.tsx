import { NavLink, Outlet } from "react-router-dom";

export default function UserLayout() {
  return (
    <div className="user-app">
      <div className="user-shell">
        <header className="user-header">
          <div className="header-left">
            <div className="header-icon">◌</div>
            <div>
              <div className="user-brand">Assistant Chat</div>
              <div className="user-status">En ligne</div>
            </div>
          </div>
          <nav className="user-nav">
            <NavLink to="/user/chat" className={({ isActive }) => `user-nav-link${isActive ? " active" : ""}`}>
              Poser une question
            </NavLink>
          </nav>
        </header>
        <main className="user-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
