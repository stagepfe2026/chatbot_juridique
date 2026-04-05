import { Navigate } from "react-router-dom";
import ConversationsListPage from "../pages/Conversations/ConversationsListPage";
import ClaimsManagementPage from "../pages/Claims/ClaimsManagementPage";
import AuditLogsPage from "../pages/AuditLogs/AuditLogsPage";
import DocumentImportPage from "../pages/Documents/DocumentsImportPage";
import DocumentsListPage from "../pages/Documents/DocumentsListPage";

export const adminRoutes = [
  { path: "", element: <Navigate to="documents/import" replace /> },
  { path: "audit-logs", element: <AuditLogsPage /> },
  { path: "documents", element: <DocumentsListPage /> },
  { path: "documents/import", element: <DocumentImportPage /> },
  { path: "conversations", element: <ConversationsListPage /> },
  { path: "claims", element: <ClaimsManagementPage /> },
];
