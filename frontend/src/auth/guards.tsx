import { Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "../models/auth.models";
import { useAuth } from "./AuthContext";

function roleHomePath(role: UserRole): string {
  return role === "ADMIN" ? "/admin/documents" : "/user/chat";
}

export function RequireAuth({ children, allowedRoles }: { children: React.ReactElement; allowedRoles: UserRole[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="auth-loading">Verification de la session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="auth-loading">Verification de la session...</div>;
  }

  if (user) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return children;
}

export function RoleHomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="auth-loading">Verification de la session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={roleHomePath(user.role)} replace />;
}
