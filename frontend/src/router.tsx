import { createBrowserRouter } from "react-router-dom";
import AdminLayout from "./admin/layouts/AdminLayout";
import { adminRoutes } from "./admin/routes/adminRoutes";
import { PublicOnlyRoute, RequireAuth, RoleHomeRedirect } from "./auth/guards";
import LoginPage from "./pages/LoginPage";
import UserLayout from "./user/layouts/UserLayout";
import { userRoutes } from "./user/routes/userRoutes";

// Router principal: login public + espaces admin/user proteges par role.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RoleHomeRedirect />,
  },
  {
    path: "/login",
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <RequireAuth allowedRoles={["ADMIN"]}>
        <AdminLayout />
      </RequireAuth>
    ),
    children: adminRoutes,
  },
  {
    path: "/user",
    element: (
      <RequireAuth allowedRoles={["FINANCE_USER"]}>
        <UserLayout />
      </RequireAuth>
    ),
    children: userRoutes,
  },
]);
