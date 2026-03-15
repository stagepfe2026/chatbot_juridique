import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SourceFile } from "../../models/chat.models";
import type { ConversationMessage, ConversationSummary } from "../../models/conversation.models";
import {
  askQuestion,
  getConversationMessages,
  getQuestionSuggestions,
  listMyConversations,
} from "../../services/user.service";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  questionId?: string | null;
  sourceFile?: SourceFile | null;
};

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-hidden="true"
    >
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

function sanitizeAnswerText(text: string): string {
  let t = String(text ?? "");
  t = t.replace(/\bchunk_\d+\b/gi, "");
  t = t.replace(/\s*:\s*(?=[)\]])/g, "");
  t = t.replace(/\s+et\s+(?=[)\],;\.])/gi, " ");
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t;
}

function fromConversationMessages(messages: ConversationMessage[]): ChatMessage[] {
  return messages.map((item) => ({
    id: item.id,
    role: item.role,
    text: item.role === "assistant" ? sanitizeAnswerText(item.content) : item.content,
    time: new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    questionId: item.questionId ?? null,
    sourceFile: item.sourceFile ?? null,
  }));
}

function countTypedWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export default function AskQuestionPage() {
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyItems, setHistoryItems] = useState<ConversationSummary[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [hiddenHistoryIds] = useState<Record<string, boolean>>({});
  const [customTitles] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [hasSuggestionSearch, setHasSuggestionSearch] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const trimmedQuestion = question.trim();
    if (countTypedWords(trimmedQuestion) < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      setHasSuggestionSearch(false);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);

    const timer = window.setTimeout(() => {
      void getQuestionSuggestions(trimmedQuestion, 5)
        .then((items) => {
          if (cancelled) return;
          setSuggestions(items);
          setSuggestionsOpen(true);
          setHasSuggestionSearch(true);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setSuggestionsOpen(true);
          setHasSuggestionSearch(true);
        })
        .finally(() => {
          if (cancelled) return;
          setSuggestionsLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [question]);

  const visibleHistory = useMemo(
    () =>
      [...historyItems]
        .filter((item) => !hiddenHistoryIds[item.id])
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [historyItems, hiddenHistoryIds],
  );

  function resetSuggestions() {
    setSuggestions([]);
    setSuggestionsOpen(false);
    setSuggestionsLoading(false);
    setHasSuggestionSearch(false);
  }

  function startNewQuestion() {
    setConversationId(undefined);
    setMessages([]);
    setQuestion("");
    resetSuggestions();
    setError(null);
    setActiveHistoryId(null);
  }

  async function openHistoryItem(item: ConversationSummary) {
    try {
      setError(null);
      setActiveHistoryId(item.id);
      setConversationId(item.id);
      resetSuggestions();
      const data = await getConversationMessages(item.id);
      setMessages(fromConversationMessages(data));
    } catch {
      setError("Erreur de chargement de la conversation.");
    }
  }

  async function onAsk() {
    const currentQuestion = question.trim();
    if (!currentQuestion || loading) return;

    try {
      setLoading(true);

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: currentQuestion,
        time: nowAsTime(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setQuestion("");
      resetSuggestions();

      const res = await askQuestion({ question: currentQuestion, conversationId });

      setConversationId(res.conversationId);
      setActiveHistoryId(res.conversationId);

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: sanitizeAnswerText(res.answer),
        time: nowAsTime(),
        questionId: res.questionId,
        sourceFile: res.sourceFile ?? null,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      await refreshHistory();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[calc(100vh-140px)] gap-4 ">

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border border-slate-200 bg-white p-3 sticky top-6 h-[calc(100vh-120px)] overflow-y-auto rounded-xl">
          <button
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold hover:bg-red-50 hover:text-red-600"
            onClick={startNewQuestion}
          >
            <Icon><path d="M12 5v14"/><path d="M5 12h14"/></Icon>
            Nouvelle conversation
          </button>

          <div className="mt-4 text-[10px] uppercase tracking-wide text-slate-400">Conversations</div>

          <div className="mt-3 space-y-2">
            {visibleHistory.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  activeHistoryId === item.id
                    ? "border-red-200 bg-red-50"
                    : "border-transparent hover:bg-slate-50"
                }`}
                onClick={() => void openHistoryItem(item)}
              >
                <div className="truncate font-medium text-slate-800">{customTitles[item.id] ?? item.title}</div>
                <div className="text-xs text-slate-400">{formatDayLabel(item.updatedAt)}</div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Chat */}
      <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Assistant Juridique IA</div>
            <div className="text-xs text-slate-500">Posez vos questions juridiques</div>
          </div>

          <button
            className="rounded-lg border border-slate-200 p-2 hover:bg-red-50 hover:text-red-600"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            <Icon>
              <path d="M4 7h16"/>
              <path d="M4 12h16"/>
              <path d="M4 17h16"/>
            </Icon>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 scroll-smooth">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl rounded-xl px-3 py-2 text-sm ${
                message.role === "user" ? "bg-red-600 text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-800 shadow-sm"
              }`}>
                <div className="whitespace-pre-wrap">{message.text}</div>
                {message.sourceFile && (
                  <a
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    href={message.sourceFile.downloadUrl}
                    download={message.sourceFile.filename}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-600">
                      <Icon size={14}>
                        <path d="M8 3h6l4 4v14H6V3z" />
                        <path d="M14 3v4h4" />
                      </Icon>
                    </span>
                    <span className="truncate">{message.sourceFile.filename}</span>
                  </a>
                )}
                <div className="mt-1 text-[10px] opacity-70">{message.time}</div>
              </div>
            </div>
          ))}

          {loading && <div className="text-sm text-slate-400">IA en train de répondre...</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-300"
                rows={2}
                placeholder="Posez votre question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => {
                  if (countTypedWords(question) >= 3) {
                    setSuggestionsOpen(true);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => setSuggestionsOpen(false), 120);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onAsk();
                  }
                }}
              />

              {suggestionsOpen && (
                <div className="absolute inset-x-0 bottom-[calc(100%+10px)] z-30 grid gap-1.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)]" role="listbox" aria-label="Suggestions automatiques">
                  {suggestionsLoading ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500">Recherche de suggestions...</div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-900 transition hover:-translate-y-px hover:bg-red-50 hover:text-red-700"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setQuestion(suggestion);
                          setSuggestionsOpen(false);
                        }}
                      >
                        {suggestion}
                      </button>
                    ))
                  ) : hasSuggestionSearch ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500">Aucune suggestion disponible pour le moment.</div>
                  ) : null}
                </div>
              )}
            </div>
            <button
              onClick={() => void onAsk()}
              disabled={!question.trim() || loading}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Icon>
                <path d="m22 2-10 10"/>
                <path d="m22 2-7 20-3-9-9-3z"/>
              </Icon>
            </button>
          </div>
        </div>

      </section>
    </div>
  );
}




