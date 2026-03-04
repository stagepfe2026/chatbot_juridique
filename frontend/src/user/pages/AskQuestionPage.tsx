import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { SourceFile } from "../../models/chat.models";
import type { ConversationMessage, ConversationSummary } from "../../models/conversation.models";
import { useAuth } from "../../auth/AuthContext";
import { askQuestion, getConversationMessages, listMyConversations } from "../../services/user.service";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  sourceFile?: SourceFile | null;
};

function Icon({
  children,
  size = 18,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {children}
    </svg>
  );
}

function nowAsTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startToday.getTime() - startTarget.getTime()) / 86_400_000);

  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return `Il y a ${diffDays} jours`;
}

function fromConversationMessages(messages: ConversationMessage[]): ChatMessage[] {
  return messages.map((item) => ({
    id: item.id,
    role: item.role,
    text: item.content,
    time: new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    sourceFile: null,
  }));
}

export default function AskQuestionPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [historyItems, setHistoryItems] = useState<ConversationSummary[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [hiddenHistoryIds, setHiddenHistoryIds] = useState<Record<string, boolean>>({});
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("legal-chat-theme");
    setDarkMode(stored === "dark");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("legal-chat-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function refreshHistory() {
    try {
      const items = await listMyConversations();
      setHistoryItems(items);
    } catch {
      setHistoryItems([]);
    }
  }

  useEffect(() => {
    void refreshHistory();
  }, []);

  const visibleHistory = useMemo(
    () =>
      historyItems
        .filter((item) => !hiddenHistoryIds[item.id])
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [historyItems, hiddenHistoryIds],
  );

  function startNewQuestion() {
    setConversationId(undefined);
    setMessages([]);
    setQuestion("");
    setError(null);
    setActiveHistoryId(null);
  }

  async function openHistoryItem(item: ConversationSummary) {
    try {
      setError(null);
      setActiveHistoryId(item.id);
      setConversationId(item.id);
      const data = await getConversationMessages(item.id);
      setMessages(fromConversationMessages(data));
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur de chargement de la conversation.")
          : "Erreur de chargement de la conversation.";
      setError(message);
    }
  }

  function onEditHistory(item: ConversationSummary) {
    const updated = window.prompt("Modifier le titre de la consultation", customTitles[item.id] ?? item.title);
    if (!updated || !updated.trim()) return;
    setCustomTitles((prev) => ({ ...prev, [item.id]: updated.trim() }));
  }

  function onDeleteHistory(item: ConversationSummary) {
    setHiddenHistoryIds((prev) => ({ ...prev, [item.id]: true }));
    if (activeHistoryId === item.id) {
      startNewQuestion();
    }
  }

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function onAsk() {
    const currentQuestion = question.trim();
    if (!currentQuestion || loading) return;

    try {
      setLoading(true);
      setError(null);

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: currentQuestion,
        time: nowAsTime(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setQuestion("");

      const res = await askQuestion({ question: currentQuestion, conversationId });
      setConversationId(res.conversationId);
      setActiveHistoryId(res.conversationId);

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.answer,
        time: nowAsTime(),
        sourceFile: res.sourceFile ?? null,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      await refreshHistory();
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors de la question.")
          : "Erreur lors de la question.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`legal-chat-app${darkMode ? " dark" : ""}`}>
      <aside className={`legal-sidebar${sidebarOpen ? " open" : " closed"}`}>
        <button className="new-question-btn" type="button" onClick={startNewQuestion}>
          <span className="btn-icon">
            <Icon size={15}>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </Icon>
          </span>
          Nouvelle Conversation
        </button>

        <div className="sidebar-section-title">Consultations recentes</div>
        <div className="sidebar-history">
          {visibleHistory.length === 0 && <div className="history-empty">Aucune conversation recente.</div>}
          {visibleHistory.map((item) => (
            <div
              key={item.id}
              className={`history-item${activeHistoryId === item.id ? " active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => void openHistoryItem(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void openHistoryItem(item);
                }
              }}
            >
              <span className="history-icon">
                <Icon size={14}>
                  <path d="M4 6h16v12H4z" />
                  <path d="M8 10h8" />
                </Icon>
              </span>
              <span className="history-content">
                <span className="history-title">{customTitles[item.id] ?? item.title}</span>
                <span className="history-time">{formatDayLabel(item.updatedAt)}</span>
              </span>
              <span className="history-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="history-action-btn" onClick={() => onEditHistory(item)} aria-label="Modifier">
                  <Icon size={14}>
                    <path d="M4 20h4l10-10-4-4L4 16z" />
                  </Icon>
                </button>
                <button type="button" className="history-action-btn" onClick={() => onDeleteHistory(item)} aria-label="Supprimer">
                  <Icon size={14}>
                    <path d="M4 7h16" />
                    <path d="M9 7V4h6v3" />
                    <path d="M7 7l1 13h8l1-13" />
                  </Icon>
                </button>
              </span>
            </div>
          ))}
        </div>
      </aside>

      <section className="legal-chat-main">
        <header className="legal-topbar">
          <div className="topbar-left">
            <button className="icon-btn" type="button" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Basculer menu">
              <Icon>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </Icon>
            </button>
            <div className="brand-logo">
              <Icon size={16}>
                <path d="M8 3h6l4 4v14H6V3z" />
                <path d="M14 3v4h4" />
                <path d="M9 13h6" />
              </Icon>
            </div>
            <div className="brand-title">Assistant Juridique</div>
          </div>
          <div className="topbar-right">
            <button className="icon-btn" type="button" onClick={() => setDarkMode((prev) => !prev)} aria-label="Changer theme">
              {darkMode ? (
                <Icon>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                </Icon>
              ) : (
                <Icon>
                  <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
                </Icon>
              )}
            </button>
            <button className="icon-btn" type="button" aria-label="Profil">
              <Icon>
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </Icon>
            </button>
            <button className="icon-btn" type="button" onClick={onLogout} aria-label="Deconnexion">
              <Icon>
                <path d="M10 5H5v14h5" />
                <path d="M14 12h7" />
                <path d="m18 8 4 4-4 4" />
              </Icon>
            </button>
          </div>
        </header>

        <main className="legal-chat-area">
          <section className="messages-panel">
            {messages.length === 0 ? (
              <div className="empty-chat-state">
                <div className="empty-logo">
                  <Icon size={28}>
                    <path d="M8 3h6l4 4v14H6V3z" />
                    <path d="M14 3v4h4" />
                    <path d="M9 13h6" />
                  </Icon>
                </div>
                <h1>Assistant Juridique IA</h1>
                <p>Posez vos questions juridiques basees sur notre base documentaire</p>
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message-row ${message.role}`}>
                  <div className={`message-avatar ${message.role}`}>{message.role === "user" ? "U" : "IA"}</div>
                  <div className={`message-bubble ${message.role}`}>
                    <p>{message.text}</p>
                    {message.sourceFile && (
                      <a className="chat-file-card" href={message.sourceFile.downloadUrl} download={message.sourceFile.filename}>
                        <span className="chat-file-icon">
                          <Icon size={14}>
                            <path d="M8 3h6l4 4v14H6V3z" />
                            <path d="M14 3v4h4" />
                          </Icon>
                        </span>
                        <span className="chat-file-name">{message.sourceFile.filename}</span>
                      </a>
                    )}
                    <div className="message-time">{message.time}</div>
                  </div>
                </article>
              ))
            )}

            {loading && (
              <article className="message-row assistant">
                <div className="message-avatar assistant">IA</div>
                <div className="message-bubble assistant typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </article>
            )}
          </section>

          <section className="composer-panel">
            <div className="composer-shell">
             
              <textarea
                className="composer-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onAsk();
                  }
                }}
                placeholder="Posez votre question juridique..."
                rows={2}
              />
              <button className="send-btn" type="button" onClick={() => void onAsk()} disabled={loading || !question.trim()}>
                <Icon>
                  <path d="m22 2-10 10" />
                  <path d="m22 2-7 20-3-9-9-3z" />
                </Icon>
              </button>
            </div>
            
            {error && <div className="message-error">{error}</div>}
          </section>
        </main>
      </section>
    </div>
  );
}
