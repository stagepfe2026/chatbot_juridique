import ConversationsListPage from "../pages/Conversations/ConversationsListPage";
import DocumentImportPage from "../pages/Documents/DocumentsImportPage";
import DocumentsListPage from "../pages/Documents/DocumentsListPage";

export const adminRoutes = [
  { path: "documents", element: <DocumentsListPage /> },
  { path: "documents/import", element: <DocumentImportPage /> },
  { path: "conversations", element: <ConversationsListPage /> },
];
