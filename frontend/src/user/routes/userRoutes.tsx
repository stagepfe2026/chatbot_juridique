import AskQuestionPage from "../pages/AskQuestionPage";
import ConversationsHistoryPage from "../pages/ConversationsHistoryPage";
import SourcesPage from "../pages/SourcesPage";

// Routes accessibles cote utilisateur final.
export const userRoutes = [
  // Page de question/reponse (chat RAG).
  { path: "chat", element: <AskQuestionPage /> },
  // Historique personnel des echanges.
  { path: "conversations", element: <ConversationsHistoryPage /> },
  // Page qui affiche les sources d'une question donnee.
  { path: "chat/sources/:questionId", element: <SourcesPage /> },
];
