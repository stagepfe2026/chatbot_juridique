import ConversationsListPage from "../pages/Conversations/ConversationsListPage";
import AuditLogsPage from "../pages/AuditLogs/AuditLogsPage";
import DocumentImportPage from "../pages/Documents/DocumentsImportPage";
import DocumentsListPage from "../pages/Documents/DocumentsListPage";

export const adminRoutes = [
  { path: "audit-logs", element: <AuditLogsPage /> },
  { path: "documents", element: <DocumentsListPage /> },
  { path: "documents/import", element: <DocumentImportPage /> },
  { path: "conversations", element: <ConversationsListPage /> },
];

