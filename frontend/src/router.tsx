import { Navigate, createBrowserRouter } from "react-router-dom";
import { adminRoutes } from "./admin/routes/adminRoutes";
import AdminLayout from "./admin/layouts/AdminLayout";
import UserLayout from "./user/layouts/UserLayout";
import { userRoutes } from "./user/routes/userRoutes";

// Router principal: redirection racine + espaces admin et user.
export const router = createBrowserRouter([
  {
    // Redirige vers le chat user par défaut.
    path: "/",
    element: <Navigate to="/user/chat" replace />,
  },
  {
    // Zone administration (gestion des documents).
    path: "/admin",
    element: <AdminLayout />,
    children: adminRoutes,
  },
  {
    // Zone utilisateur (questions et sources).
    path: "/user",
    element: <UserLayout />,
    children: userRoutes,
  },
]);
