import AskQuestionPage from "../pages/AskQuestionPage";
import SourcesPage from "../pages/SourcesPage";

export const userRoutes = [
  { path: "chat", element: <AskQuestionPage /> },
  { path: "chat/sources/:questionId", element: <SourcesPage /> },
];
