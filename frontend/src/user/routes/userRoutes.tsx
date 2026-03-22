import AskQuestionPage from "../pages/AskQuestionPage";
import ClaimPage from "../pages/ClaimPage";
import ConversationsHistoryPage from "../pages/ConversationsHistoryPage";
import FavoriteDocumentsPage from "../pages/FavoriteDocumentsPage";
import ProfilePage from "../pages/ProfilePage";
import SearchDocumentsPage from "../pages/SearchDocumentsPage";
import SourcesPage from "../pages/SourcesPage";
import UserHomePage from "../pages/UserHomePage";

// Routes accessibles cote utilisateur final.
export const userRoutes = [
  { index: true, element: <UserHomePage /> },
  { path: "accueil", element: <UserHomePage /> },
  { path: "recherche", element: <SearchDocumentsPage /> },
  { path: "favoris", element: <FavoriteDocumentsPage /> },
  { path: "profil", element: <ProfilePage /> },
  { path: "reclamations", element: <ClaimPage /> },
  // Page de question/reponse (chat RAG).
  { path: "chat", element: <AskQuestionPage /> },
  // Historique personnel des echanges.
  { path: "conversations", element: <ConversationsHistoryPage /> },
  // Page qui affiche les sources d'une question donnee.
  { path: "chat/sources/:questionId", element: <SourcesPage /> },
];
