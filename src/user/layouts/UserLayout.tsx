import { NavLink, Outlet } from "react-router-dom";

export default function UserLayout() {
  return (
    <div className="admin-app">
      <div className="admin-shell">
        <header className="admin-header">
          <div className="admin-brand">Assistant Juridique</div>
          <nav className="admin-nav">
            <NavLink to="/user/chat" className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
              Poser une question
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
