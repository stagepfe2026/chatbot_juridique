import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import jsPDF from "jspdf";
import type { SourceFile } from "../../models/chat.models";
import type { ConversationMessage, ConversationSummary } from "../../models/conversation.models";
import {
  archiveConversation,
  askQuestion,
  deleteConversation,
  getConversationMessages,
  getQuestionSuggestions,
  listMyConversations,
  renameConversation,
  restoreConversation,
} from "../../services/user.service";
import { publishSnackbar } from "../../utils/snackbarBus";

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

function slugifyFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildPdfFilename(question: string): string {
  const base = slugifyFilenamePart(question).slice(0, 60) || "reponse-juridique";
  return `${base}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function downloadAnswerPdf(question: string, answer: string, sourceFile?: SourceFile | null): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  let cursorY = 20;

  const writeParagraph = (text: string, fontSize = 11) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    const estimatedHeight = lines.length * (fontSize * 0.45) + 4;
    if (cursorY + estimatedHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(lines, margin, cursorY);
    cursorY += estimatedHeight;
  };

  doc.setFillColor(185, 28, 28);
  doc.roundedRect(margin, 10, pageWidth - margin * 2, 18, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Assistant Juridique - Reponse exportee", margin + 4, 21);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.text(
    `Genere le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
    margin,
    36,
  );

  cursorY = 46;
  doc.setFontSize(12);
  doc.setTextColor(185, 28, 28);
  doc.text("Question", margin, cursorY);
  cursorY += 7;
  doc.setTextColor(15, 23, 42);
  writeParagraph(question || "Question non disponible.");

  cursorY += 2;
  doc.setFontSize(12);
  doc.setTextColor(185, 28, 28);
  doc.text("Reponse", margin, cursorY);
  cursorY += 7;
  doc.setTextColor(15, 23, 42);
  writeParagraph(answer || "Reponse non disponible.");

  if (sourceFile?.filename) {
    cursorY += 2;
    doc.setFontSize(12);
    doc.setTextColor(185, 28, 28);
    doc.text("Document source", margin, cursorY);
    cursorY += 7;
    doc.setTextColor(51, 65, 85);
    writeParagraph(sourceFile.filename, 10);
  }

  doc.save(buildPdfFilename(question));
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [hasSuggestionSearch, setHasSuggestionSearch] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [menuConversationId, setMenuConversationId] = useState<string | null>(null);
  const [archivesModalOpen, setArchivesModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ConversationSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        .filter((item) => !item.isArchived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [historyItems],
  );

  const archivedHistory = useMemo(
    () =>
      [...historyItems]
        .filter((item) => item.isArchived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [historyItems],
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

  async function handleArchiveConversation(target: ConversationSummary) {
    try {
      setArchivingId(target.id);
      const state = await archiveConversation(target.id);
      setHistoryItems((current) =>
        current.map((item) =>
          item.id === target.id
            ? { ...item, isArchived: state.isArchived, archivedAt: state.archivedAt, updatedAt: state.updatedAt }
            : item,
        ),
      );
      if (activeHistoryId === target.id || conversationId === target.id) {
        startNewQuestion();
      }
      publishSnackbar({ variant: "success", message: "Conversation archivee." });
    } finally {
      setArchivingId(null);
    }
  }

  async function handleRestoreConversation(target: ConversationSummary) {
    try {
      setArchivingId(target.id);
      const state = await restoreConversation(target.id);
      setHistoryItems((current) =>
        current.map((item) =>
          item.id === target.id
            ? { ...item, isArchived: state.isArchived, archivedAt: state.archivedAt, updatedAt: state.updatedAt }
            : item,
        ),
      );
      publishSnackbar({ variant: 'success', message: 'Conversation restauree.' });
    } finally {
      setArchivingId(null);
    }
  }


  function openRenameModal(target: ConversationSummary) {
    setRenameTarget(target);
    setRenameValue(target.title);
    setRenameModalOpen(true);
    setMenuConversationId(null);
  }

  async function submitRename() {
    if (!renameTarget) return;
    const next = renameValue.trim();
    if (!next) return;
    try {
      setRenamingId(renameTarget.id);
      const updated = await renameConversation(renameTarget.id, next);
      setHistoryItems((current) =>
        current.map((item) =>
          item.id === renameTarget.id ? { ...item, title: updated.title, updatedAt: updated.updatedAt } : item,
        ),
      );
      setRenameModalOpen(false);
      setRenameTarget(null);
      setRenameValue('');
      publishSnackbar({ variant: 'success', message: 'Conversation renommee.' });
    } finally {
      setRenamingId(null);
    }
  }


  async function handleDeleteConversation(target: ConversationSummary) {
    const ok = window.confirm('Supprimer la conversation ' + target.title + ' ?');
    if (!ok) return;
    try {
      setDeletingId(target.id);
      await deleteConversation(target.id);
      setHistoryItems((current) => current.filter((item) => item.id !== target.id));
      setMenuConversationId(null);
      if (activeHistoryId === target.id || conversationId === target.id) {
        startNewQuestion();
      }
      publishSnackbar({ variant: 'success', message: 'Conversation supprimee.' });
    } finally {
      setDeletingId(null);
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
      {sidebarOpen && (
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border border-slate-200 bg-white p-3 sticky top-6 h-[calc(100vh-120px)] overflow-y-auto rounded-xl">
          <div className="grid gap-2">
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold hover:bg-red-50 hover:text-red-600"
              onClick={startNewQuestion}
            >
              <Icon><path d="M12 5v14"/><path d="M5 12h14"/></Icon>
              Nouvelle conversation
            </button>
            <button
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setArchivesModalOpen(true)}
            >
              <span>Mes archives</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{archivedHistory.length}</span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
            <span>Conversations actives</span>
            <span>{visibleHistory.length}</span>
          </div>

          <div className='mt-3 space-y-2'>
            {visibleHistory.map((item) => (
              <div
                key={item.id}
                className='group relative rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-50'
              >
                <button className='block w-full appearance-none border-0 bg-transparent p-0 pr-8 text-left shadow-none outline-none' onClick={() => void openHistoryItem(item)}>
                  <div className='truncate font-medium text-slate-800'>{item.title}</div>
                  <div className='text-xs text-slate-400'>{formatDayLabel(item.updatedAt)}</div>
                </button>
                <div className='absolute right-2 top-2'>
                  <button
                    type='button'
                    onClick={() => setMenuConversationId((current) => (current === item.id ? null : item.id))}
                    className='flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100'
                    aria-label={'Actions pour ' + item.title}
                  >
                    <Icon size={15}>
                      <circle cx='6' cy='12' r='1.2' />
                      <circle cx='12' cy='12' r='1.2' />
                      <circle cx='18' cy='12' r='1.2' />
                    </Icon>
                  </button>
                  {menuConversationId === item.id && (
                    <div className='absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg'>
                      <button
                        type='button'
                        onClick={() => openRenameModal(item)}
                        className='w-full px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50'
                      >
                        Renommer
                      </button>
                      <button
                        type='button'
                        disabled={archivingId === item.id}
                        onClick={() => void handleArchiveConversation(item)}
                        className='w-full px-3 py-2 text-left text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60'
                      >
                        {archivingId === item.id ? 'Archivage...' : 'Archiver'}
                      </button>
                      <button
                        type='button'
                        disabled={deletingId === item.id}
                        onClick={() => void handleDeleteConversation(item)}
                        className='w-full px-3 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60'
                      >
                        {deletingId === item.id ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {visibleHistory.length === 0 && (
              <div className='rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-400'>
                Aucune conversation active pour le moment.
              </div>
            )}
          </div>
        </aside>
      )}

      <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-red-900">Assistant Juridique IA</div>
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

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 scroll-smooth">
          {messages.map((message, index) => {
            const relatedQuestion =
              message.role === "assistant"
                ? [...messages.slice(0, index)].reverse().find((item) => item.role === "user")?.text ?? ""
                : "";

            return (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-2xl rounded-xl px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-red-600 text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-800 shadow-sm"
                }`}>
                  <div className="whitespace-pre-wrap">{message.text}</div>
                  {message.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => downloadAnswerPdf(relatedQuestion, message.text, message.sourceFile)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-600">
                        <Icon size={14}>
                          <path d="M12 3v12" />
                          <path d="m7 10 5 5 5-5" />
                          <path d="M5 21h14" />
                        </Icon>
                      </span>
                      <span>Telecharger en PDF</span>
                    </button>
                  )}
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
            );
          })}

          {loading && <div className="text-sm text-slate-400">IA en train de répondre...</div>}
          <div ref={bottomRef} />
        </div>

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

      {renameModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4'>
          <div className='w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl'>
            <div className='text-base font-semibold text-slate-900'>Renommer la conversation</div>
            <div className='mt-1 text-sm text-slate-500'>Donnez un nom plus clair a cette conversation.</div>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className='mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-300'
              placeholder='Nouveau nom'
            />
            <div className='mt-4 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => {
                  setRenameModalOpen(false);
                  setRenameTarget(null);
                  setRenameValue('');
                }}
                className='rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
              >
                Annuler
              </button>
              <button
                type='button'
                disabled={!renameValue.trim() || (renameTarget ? renamingId === renameTarget.id : false)}
                onClick={() => void submitRename()}
                className='rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60'
              >
                {renameTarget && renamingId === renameTarget.id ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {archivesModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4'>
          <div className='w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-base font-semibold text-slate-900'>Mes archives</div>
                <div className='text-sm text-slate-500'>{archivedHistory.length} conversation(s) archivee(s)</div>
              </div>
              <button
                type='button'
                onClick={() => setArchivesModalOpen(false)}
                className='rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50'
              >
                Fermer
              </button>
            </div>
            <div className='mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1'>
              {archivedHistory.length === 0 && (
                <div className='rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400'>
                  Aucune conversation archivee.
                </div>
              )}
              {archivedHistory.map((item) => (
                <div key={item.id} className='flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2'>
                  <div className='min-w-0 pr-3'>
                    <div className='truncate text-sm font-medium text-slate-800'>{item.title}</div>
                    <div className='text-xs text-slate-400'>{formatDayLabel(item.updatedAt)}</div>
                  </div>
                  <button
                    type='button'
                    disabled={archivingId === item.id}
                    onClick={() => void handleRestoreConversation(item)}
                    className='rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60'
                  >
                    {archivingId === item.id ? 'Restauration...' : 'Restaurer'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





