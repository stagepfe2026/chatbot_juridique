import { Navigate, createBrowserRouter } from "react-router-dom";
import { adminRoutes } from "./admin/routes/adminRoutes";
import AdminLayout from "./admin/layouts/AdminLayout";
import UserLayout from "./user/layouts/UserLayout";
import { userRoutes } from "./user/routes/userRoutes";
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/user/chat" replace />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: adminRoutes,
  },
  {
    path: "/user",
    element: <UserLayout />,
    children: userRoutes,
  },
]);
