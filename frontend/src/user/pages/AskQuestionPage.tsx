import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import jsPDF from "jspdf";
import type { ResponseMode, SourceFile, SourceItem } from "../../models/chat.models";
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
import { useI18n } from "../../i18n/I18nContext";
import AskQuestionChatHeader from "../components/AskQuestionPage/ChatHeader";
import AskQuestionComposer from "../components/AskQuestionPage/Composer";
import AskQuestionMessagesPane from "../components/AskQuestionPage/MessagesPane";
import { AskQuestionArchivesModal, AskQuestionRenameModal } from "../components/AskQuestionPage/Modals";
import AskQuestionSidebar from "../components/AskQuestionPage/Sidebar";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  questionId?: string | null;
  sourceFile?: SourceFile | null;
  sources?: SourceItem[];
};
const CHAT_FEEDBACK_KEY = "chat-message-feedback";
const CHAT_CLAIM_DRAFT_KEY = "chat-claim-draft";

type UiLanguage = "fr" | "en" | "ar";

const askQuestionCopy = {
  fr: { today: "Aujourd'hui", yesterday: "Hier", daysAgo: (n: number) => `Il y a ${n} jours`, structuredResponse: "Reponse structuree", row: "ligne", rows: "lignes", conversationFileFallback: "conversation-juridique", answerFileFallback: "reponse-juridique", page: "Page", conversation: "Conversation", exportedAt: "Exportee le", user: "Utilisateur", assistant: "Assistant", sourceDocument: "Document source", legalAssistant: "Assistant Juridique", conversationExport: "Export de conversation", exportDate: "Date d'export", messageCount: "Nombre de messages", exportedAnswerTitle: "Assistant Juridique - Reponse exportee", generatedOn: "Genere le", question: "Question", response: "Reponse", questionUnavailable: "Question non disponible.", responseUnavailable: "Reponse non disponible.", newConversation: "Nouvelle conversation", myArchives: "Mes archives", activeConversations: "Conversations actives", actionsFor: "Actions pour", rename: "Renommer", archive: "Archiver", archiving: "Archivage...", delete: "Supprimer", deleting: "Suppression...", noActiveConversations: "Aucune conversation active pour le moment.", loadConversationError: "Erreur de chargement de la conversation.", conversationArchived: "Conversation archivee.", conversationRestored: "Conversation restauree.", conversationRenamed: "Conversation renommee.", deleteConfirm: (title: string) => `Supprimer la conversation ${title} ?`, conversationDeleted: "Conversation supprimee.", responseCopied: "Reponse copiee.", copyUnavailable: "Copie impossible sur ce navigateur.", positiveThanks: "Merci pour votre retour positif.", feedbackSaved: "Retour enregistre.", nothingToExport: "Aucune conversation a exporter.", conversationPdfExported: "Conversation exportee en PDF.", conversationTextExported: "Conversation exportee en texte.", reportSubject: "Signalement reponse chatbot", askedQuestion: "Question posee", answerToReview: "Reponse a verifier", claimDraftPrepared: "Un brouillon de reclamation a ete prepare.", sourcesLoadError: "Impossible de charger les sources.", copy: "Copier", hideSources: "Masquer les sources", showSources: "Voir les sources", helpful: "Utile", notHelpful: "Non utile", report: "Signaler", suggestedQuestions: "Questions suggerees", loading: "Chargement...", sourcesUsed: "Sources utilisees", sourceCount: (n: number) => `${n} source(s)`, loadingSources: "Chargement des sources...", noExcerpt: "Aucun extrait disponible.", sourceDetails: "Consulter le detail des sources", noDetailedSources: "Aucune source detaillee disponible.", noSearchResults: "Aucun message ne correspond a votre recherche.", aiResponding: "IA en train de repondre...", responseMode: "Mode de reponse", short: "Court", detailed: "Detaille", shortSummary: "Synthese rapide", detailedSummary: "Reponse complete avec plus d'explications", askPlaceholder: "Posez votre question...", suggestionsAria: "Suggestions automatiques", suggestionsLoading: "Recherche de suggestions...", noSuggestions: "Aucune suggestion disponible pour le moment.", renameConversation: "Renommer la conversation", renameHint: "Donnez un nom plus clair a cette conversation.", newName: "Nouveau nom", cancel: "Annuler", saving: "Enregistrement...", save: "Enregistrer", archivedCount: (n: number) => `${n} conversation(s) archivee(s)`, close: "Fermer", noArchived: "Aucune conversation archivee.", restoring: "Restauration...", restore: "Restaurer", searchConversation: "Rechercher dans la conversation" },
  en: { today: "Today", yesterday: "Yesterday", daysAgo: (n: number) => `${n} days ago`, structuredResponse: "Structured response", row: "row", rows: "rows", conversationFileFallback: "legal-conversation", answerFileFallback: "legal-answer", page: "Page", conversation: "Conversation", exportedAt: "Exported on", user: "User", assistant: "Assistant", sourceDocument: "Source document", legalAssistant: "Legal Assistant", conversationExport: "Conversation export", exportDate: "Export date", messageCount: "Message count", exportedAnswerTitle: "Legal Assistant - Exported answer", generatedOn: "Generated on", question: "Question", response: "Response", questionUnavailable: "Question unavailable.", responseUnavailable: "Response unavailable.", newConversation: "New conversation", myArchives: "My archives", activeConversations: "Active conversations", actionsFor: "Actions for", rename: "Rename", archive: "Archive", archiving: "Archiving...", delete: "Delete", deleting: "Deleting...", noActiveConversations: "No active conversation for now.", loadConversationError: "Failed to load the conversation.", conversationArchived: "Conversation archived.", conversationRestored: "Conversation restored.", conversationRenamed: "Conversation renamed.", deleteConfirm: (title: string) => `Delete conversation ${title}?`, conversationDeleted: "Conversation deleted.", responseCopied: "Response copied.", copyUnavailable: "Copy is not available in this browser.", positiveThanks: "Thanks for your positive feedback.", feedbackSaved: "Feedback saved.", nothingToExport: "No conversation to export.", conversationPdfExported: "Conversation exported as PDF.", conversationTextExported: "Conversation exported as text.", reportSubject: "Chatbot response report", askedQuestion: "Asked question", answerToReview: "Response to review", claimDraftPrepared: "A claim draft has been prepared.", sourcesLoadError: "Unable to load sources.", copy: "Copy", hideSources: "Hide sources", showSources: "Show sources", helpful: "Helpful", notHelpful: "Not helpful", report: "Report", suggestedQuestions: "Suggested questions", loading: "Loading...", sourcesUsed: "Sources used", sourceCount: (n: number) => `${n} source(s)`, loadingSources: "Loading sources...", noExcerpt: "No excerpt available.", sourceDetails: "View source details", noDetailedSources: "No detailed sources available.", noSearchResults: "No message matches your search.", aiResponding: "AI is answering...", responseMode: "Response mode", short: "Short", detailed: "Detailed", shortSummary: "Quick summary", detailedSummary: "Complete answer with more explanations", askPlaceholder: "Ask your question...", suggestionsAria: "Automatic suggestions", suggestionsLoading: "Searching suggestions...", noSuggestions: "No suggestions available right now.", renameConversation: "Rename conversation", renameHint: "Give this conversation a clearer name.", newName: "New name", cancel: "Cancel", saving: "Saving...", save: "Save", archivedCount: (n: number) => `${n} archived conversation(s)`, close: "Close", noArchived: "No archived conversation.", restoring: "Restoring...", restore: "Restore", searchConversation: "Search within the conversation" },
  ar: { today: "اليوم", yesterday: "امس", daysAgo: (n: number) => `قبل ${n} يوم`, structuredResponse: "اجابة منظمة", row: "سطر", rows: "اسطر", conversationFileFallback: "legal-conversation", answerFileFallback: "legal-answer", page: "صفحة", conversation: "المحادثة", exportedAt: "تم التصدير في", user: "المستخدم", assistant: "المساعد", sourceDocument: "الوثيقة المصدر", legalAssistant: "المساعد القانوني", conversationExport: "تصدير المحادثة", exportDate: "تاريخ التصدير", messageCount: "عدد الرسائل", exportedAnswerTitle: "المساعد القانوني - اجابة مصدرة", generatedOn: "تم الانشاء في", question: "السؤال", response: "الاجابة", questionUnavailable: "السؤال غير متوفر.", responseUnavailable: "الاجابة غير متوفرة.", newConversation: "محادثة جديدة", myArchives: "الارشيف", activeConversations: "المحادثات النشطة", actionsFor: "اجراءات", rename: "اعادة التسمية", archive: "ارشفة", archiving: "جار الارشفة...", delete: "حذف", deleting: "جار الحذف...", noActiveConversations: "لا توجد محادثات نشطة حاليا.", loadConversationError: "تعذر تحميل المحادثة.", conversationArchived: "تمت ارشفة المحادثة.", conversationRestored: "تمت استعادة المحادثة.", conversationRenamed: "تمت اعادة تسمية المحادثة.", deleteConfirm: (title: string) => `حذف المحادثة ${title}؟`, conversationDeleted: "تم حذف المحادثة.", responseCopied: "تم نسخ الاجابة.", copyUnavailable: "النسخ غير متاح في هذا المتصفح.", positiveThanks: "شكرا على تقييمك الايجابي.", feedbackSaved: "تم حفظ التقييم.", nothingToExport: "لا توجد محادثة للتصدير.", conversationPdfExported: "تم تصدير المحادثة PDF.", conversationTextExported: "تم تصدير المحادثة كنص.", reportSubject: "تبليغ عن جواب الشاتبوت", askedQuestion: "السؤال المطروح", answerToReview: "الاجابة المطلوب التحقق منها", claimDraftPrepared: "تم اعداد مسودة شكاية.", sourcesLoadError: "تعذر تحميل المصادر.", copy: "نسخ", hideSources: "اخفاء المصادر", showSources: "عرض المصادر", helpful: "مفيد", notHelpful: "غير مفيد", report: "تبليغ", suggestedQuestions: "اسئلة مقترحة", loading: "جار التحميل...", sourcesUsed: "المصادر المستعملة", sourceCount: (n: number) => `${n} مصدر`, loadingSources: "جار تحميل المصادر...", noExcerpt: "لا يوجد مقتطف متاح.", sourceDetails: "عرض تفاصيل المصادر", noDetailedSources: "لا توجد مصادر مفصلة.", noSearchResults: "لا توجد رسالة تطابق بحثك.", aiResponding: "الذكاء الاصطناعي يجيب...", responseMode: "وضع الاجابة", short: "قصير", detailed: "مفصل", shortSummary: "خلاصة سريعة", detailedSummary: "اجابة كاملة مع شروحات اكثر", askPlaceholder: "اطرح سؤالك...", suggestionsAria: "اقتراحات تلقائية", suggestionsLoading: "جار البحث عن اقتراحات...", noSuggestions: "لا توجد اقتراحات حاليا.", renameConversation: "اعادة تسمية المحادثة", renameHint: "امنح هذه المحادثة اسما اوضح.", newName: "اسم جديد", cancel: "الغاء", saving: "جار الحفظ...", save: "حفظ", archivedCount: (n: number) => `${n} محادثة مؤرشفة`, close: "اغلاق", noArchived: "لا توجد محادثات مؤرشفة.", restoring: "جار الاستعادة...", restore: "استعادة", searchConversation: "ابحث داخل المحادثة" },
} as const;

type AskQuestionLabels = (typeof askQuestionCopy)[UiLanguage];

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

function nowAsTime(locale: string) {
  return new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(dateString: string, labels: AskQuestionLabels = askQuestionCopy.fr): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startToday.getTime() - startTarget.getTime()) / 86_400_000);

  if (diffDays <= 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  return labels.daysAgo(diffDays);
}

function sanitizeAnswerText(text: string): string {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\bchunk_\d+\b/gi, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/\s*:\s*(?=[)\]])/g, "")
        .replace(/\s+et\s+(?=[)\],;.])/gi, " ")
        .replace(/\(\s*\)/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trimEnd(),
    );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitMarkdownRow(line: string): string[] {
  const normalized = line.trim().replace(/^[-*]\s+/, "").replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => cell.trim());
}

function isMarkdownSeparatorLine(line: string): boolean {
  const normalized = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return normalized.length > 0 && normalized.split("|").every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isNumericLikeCell(cell: string): boolean {
  const normalized = cell.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized || normalized === "-") return false;
  return /\d/.test(normalized) && /(%|dinars?|taux|tranche|,|\.)/.test(normalized);
}

function getTableCellAlignment(cell: string): string {
  return isNumericLikeCell(cell) ? "text-right font-medium tabular-nums text-slate-900" : "text-left text-slate-700";
}

function escapeRegExp(value: string): string {
  const specialCharacters = new Set(["\\", ".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
  return [...value].map((char) => (specialCharacters.has(char) ? `\\${char}` : char)).join("");
}

function renderHighlightedText(text: string, searchQuery: string): ReactNode {
  if (!searchQuery.trim()) return text;

  const pattern = new RegExp(`(${escapeRegExp(searchQuery.trim())})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    ),
  );
}

function renderAssistantContent(text: string, searchQuery = "", labels: AskQuestionLabels = askQuestionCopy.fr): ReactNode {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = (lines[i] ?? "").trim();
    if (!line) {
      i += 1;
      continue;
    }

    const nextLine = (lines[i + 1] ?? "").trim();
    if (line.includes("|") && isMarkdownSeparatorLine(nextLine)) {
      const tableLines = [line, nextLine];
      i += 2;
      while (i < lines.length) {
        const candidate = (lines[i] ?? "").trim();
        if (!candidate || !candidate.includes("|")) break;
        tableLines.push(candidate);
        i += 1;
      }

      const header = splitMarkdownRow(tableLines[0]);
      const rows = tableLines.slice(2).map(splitMarkdownRow).filter((row) => row.some(Boolean));

      blocks.push(
        <div key={`table-${blocks.length}`} className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.structuredResponse}</div>
            <div className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
              {rows.length} {rows.length > 1 ? labels.rows : labels.row}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {header.map((cell, index) => (
                    <th
                      key={`head-${index}`}
                      className={`border-b border-slate-200 px-3 py-2.5 ${isNumericLikeCell(cell) ? "text-right" : "text-left"}`}
                    >
                      {renderHighlightedText(cell, searchQuery)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80">
                    {header.map((_, cellIndex) => {
                      const value = row[cellIndex] ?? "-";
                      return (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className={`px-3 py-2.5 align-top leading-5.5 ${getTableCellAlignment(value)}`}
                        >
                          {renderHighlightedText(value, searchQuery)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const candidate = (lines[i] ?? "").trim();
        if (!/^[-*]\s+/.test(candidate)) break;
        items.push(candidate.replace(/^[-*]\s+/, ""));
        i += 1;
      }

      blocks.push(
        <ul key={`list-${blocks.length}`} className="my-2.5 space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`item-${index}`}
              className="flex gap-3 rounded-lg border-l-2 border-red-400/70 bg-white/80 px-3 py-2 text-slate-700"
            >
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-red-500/90" aria-hidden="true" />
              <span className="leading-6 text-slate-700">{renderHighlightedText(item, searchQuery)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines = [line];
    i += 1;
    while (i < lines.length) {
      const candidate = (lines[i] ?? "").trim();
      const candidateNext = (lines[i + 1] ?? "").trim();
      if (!candidate) break;
      if (/^[-*]\s+/.test(candidate)) break;
      if (candidate.includes("|") && isMarkdownSeparatorLine(candidateNext)) break;
      paragraphLines.push(candidate);
      i += 1;
    }

    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="leading-6 text-slate-700">
        {renderHighlightedText(paragraphLines.join(" "), searchQuery)}
      </p>,
    );
  }

  return <Fragment>{blocks}</Fragment>;
}

function fromConversationMessages(messages: ConversationMessage[], locale: string): ChatMessage[] {
  return messages.map((item) => ({
    id: item.id,
    role: item.role,
    text: item.role === "assistant" ? sanitizeAnswerText(item.content) : item.content,
    time: new Date(item.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
    questionId: item.questionId ?? null,
    sourceFile: item.sourceFile ?? null,
    sources: [],
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
  const base = slugifyFilenamePart(question).slice(0, 60) || askQuestionCopy.fr.answerFileFallback;
  return `${base}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function buildConversationExportFilename(title: string, extension: "pdf" | "txt"): string {
  const base = slugifyFilenamePart(title).slice(0, 60) || askQuestionCopy.fr.conversationFileFallback;
  return `${base}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function readFeedbackStore(): Record<string, "up" | "down"> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHAT_FEEDBACK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, "up" | "down">) : {};
  } catch {
    return {};
  }
}

function writeFeedbackStore(value: Record<string, "up" | "down">): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_FEEDBACK_KEY, JSON.stringify(value));
}

type PdfAnswerBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] };

function parseAnswerBlocks(text: string): PdfAnswerBlock[] {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: PdfAnswerBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = (lines[i] ?? "").trim();
    if (!line) {
      i += 1;
      continue;
    }

    const nextLine = (lines[i + 1] ?? "").trim();
    if (line.includes("|") && isMarkdownSeparatorLine(nextLine)) {
      const tableLines = [line, nextLine];
      i += 2;
      while (i < lines.length) {
        const candidate = (lines[i] ?? "").trim();
        if (!candidate || !candidate.includes("|")) break;
        tableLines.push(candidate);
        i += 1;
      }

      const header = splitMarkdownRow(tableLines[0]);
      const rows = tableLines.slice(2).map(splitMarkdownRow).filter((row) => row.some(Boolean));
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const candidate = (lines[i] ?? "").trim();
        if (!/^[-*]\s+/.test(candidate)) break;
        items.push(candidate.replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines = [line];
    i += 1;
    while (i < lines.length) {
      const candidate = (lines[i] ?? "").trim();
      const candidateNext = (lines[i + 1] ?? "").trim();
      if (!candidate) break;
      if (/^[-*]\s+/.test(candidate)) break;
      if (candidate.includes("|") && isMarkdownSeparatorLine(candidateNext)) break;
      paragraphLines.push(candidate);
      i += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function downloadFile(filename: string, content: BlobPart, mimeType: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function downloadConversationText(title: string, messages: ChatMessage[], locale: string, labels: AskQuestionLabels = askQuestionCopy.fr): void {
  const exportedAt = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const lines = [
    `${labels.conversation} : ${title}`,
    `${labels.exportedAt} : ${exportedAt}`,
    "",
    ...messages.flatMap((message) => [
      `[${message.time}] ${message.role === "user" ? labels.user : labels.assistant}`,
      message.text,
      message.sourceFile?.filename ? `${labels.sourceDocument} : ${message.sourceFile.filename}` : "",
      "",
    ]),
  ];

  downloadFile(buildConversationExportFilename(title, "txt"), lines.join("\n"), "text/plain;charset=utf-8");
}

function downloadConversationPdf(title: string, messages: ChatMessage[], locale: string, labels: AskQuestionLabels = askQuestionCopy.fr): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const safeTitle = title || labels.conversationFileFallback;
  let cursorY = 42;

  const toConversationParagraphs = (text: string): string[] => {
    const blocks = parseAnswerBlocks(text || "");
    if (!blocks.length) return [text || "-"];

    return blocks.flatMap((block) => {
      if (block.type === "paragraph") return [block.text];
      if (block.type === "list") return block.items.map((item) => `- ${item}`);
      return [block.header.join(" | "), ...block.rows.map((row) => row.join(" | "))];
    });
  };

  const drawPageChrome = () => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin, 16, pageWidth - margin, 16);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(labels.legalAssistant, margin, 12);
  };

  const addPage = () => {
    doc.addPage();
    drawPageChrome();
    cursorY = 26;
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height <= pageHeight - 22) return;
    addPage();
  };

  const writeParagraph = (text: string, fontSize = 10.5, color: [number, number, number] = [15, 23, 42]) => {
    const lines = doc.splitTextToSize(text || "-", contentWidth);
    const lineHeight = Math.max(5, fontSize * 0.42 + 1.2);
    const blockHeight = lines.length * lineHeight;
    ensureSpace(blockHeight + 1);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(lines, margin, cursorY);
    cursorY += blockHeight + 1;
  };

  const drawMessage = (message: ChatMessage) => {
    const paragraphs = toConversationParagraphs(message.text);
    const previewLines = paragraphs.flatMap((paragraph) => doc.splitTextToSize(paragraph || "-", contentWidth));
    const textHeight = previewLines.reduce((total, line) => total + (Array.isArray(line) ? line.length : 1) * 4.8, 0);
    const sourceHeight = message.sourceFile?.filename ? 6 : 0;
    ensureSpace(14 + textHeight + sourceHeight);

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(message.role === "user" ? labels.user : labels.assistant, margin, cursorY);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(message.time, pageWidth - margin, cursorY, { align: "right" });

    cursorY += 3;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 5;

    paragraphs.forEach((paragraph) => {
      writeParagraph(paragraph);
    });

    if (message.sourceFile?.filename) {
      writeParagraph(`${labels.sourceDocument} : ${message.sourceFile.filename}`, 9.5, [100, 116, 139]);
    }

    cursorY += 4;
  };

  drawPageChrome();

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(labels.conversationExport, margin, 28);

  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(safeTitle, contentWidth);
  doc.text(titleLines, margin, 36);

  cursorY = 48;
  writeParagraph(`${labels.exportDate} : ${generatedAt}`, 9.5, [71, 85, 105]);
  writeParagraph(`${labels.messageCount} : ${messages.length}`, 9.5, [71, 85, 105]);
  cursorY += 2;

  messages.forEach((message) => {
    drawMessage(message);
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${labels.page} ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 8.5, { align: "right" });
  }

  doc.save(buildConversationExportFilename(title, "pdf"));
}

function downloadAnswerPdf(question: string, answer: string, sourceFile?: SourceFile | null, locale = "fr-FR", labels: AskQuestionLabels = askQuestionCopy.fr): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const blocks = parseAnswerBlocks(answer || "");
  let cursorY = 20;

  const ensureSpace = (height: number) => {
    if (cursorY + height <= pageHeight - margin) return;
    doc.addPage();
    cursorY = margin;
  };

  const writeParagraph = (text: string, fontSize = 11, color: [number, number, number] = [15, 23, 42]) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = Math.max(5, fontSize * 0.42 + 1.2);
    const blockHeight = lines.length * lineHeight + 1;
    ensureSpace(blockHeight);
    doc.text(lines, margin, cursorY);
    cursorY += blockHeight;
  };

  const writeSectionLabel = (label: string) => {
    ensureSpace(10);
    doc.setFontSize(12);
    doc.setTextColor(185, 28, 28);
    doc.text(label, margin, cursorY);
    cursorY += 7;
  };

  const drawList = (items: string[]) => {
    items.forEach((item) => {
      const textX = margin + 8;
      const maxWidth = contentWidth - 10;
      const lines = doc.splitTextToSize(item, maxWidth);
      const lineHeight = 5.5;
      const itemHeight = Math.max(10, lines.length * lineHeight + 4);
      ensureSpace(itemHeight);

      doc.setDrawColor(248, 113, 113);
      doc.setLineWidth(0.5);
      doc.line(margin + 1.5, cursorY + 1, margin + 1.5, cursorY + itemHeight - 1);

      doc.setFillColor(220, 38, 38);
      doc.circle(margin + 4, cursorY + 3.5, 1.1, "F");

      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text(lines, textX, cursorY + 5);
      cursorY += itemHeight;
    });
  };

  const drawTable = (header: string[], rows: string[][]) => {
    if (!header.length) return;

    const safeRows = rows.map((row) => header.map((_, index) => row[index] ?? "-"));
    const colWidths = header.map((_, index) => {
      if (header.length === 3 && index === 0) return contentWidth * 0.42;
      if (header.length === 3 && index > 0) return contentWidth * 0.29;
      return contentWidth / header.length;
    });

    const drawHeader = () => {
      ensureSpace(12);
      let x = margin;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(10);
      header.forEach((cell, index) => {
        const width = colWidths[index];
        doc.rect(x, cursorY, width, 10, "FD");
        const cellLines = doc.splitTextToSize(cell, width - 4);
        doc.text(cellLines, x + 2, cursorY + 4.5);
        x += width;
      });
      cursorY += 10;
    };

    drawHeader();

    safeRows.forEach((row) => {
      const wrapped = row.map((cell, index) => doc.splitTextToSize(cell, colWidths[index] - 4));
      const rowHeight = Math.max(...wrapped.map((lines) => lines.length * 4.8 + 4), 10);
      ensureSpace(rowHeight + 1);
      if (cursorY === margin) {
        drawHeader();
      }

      let x = margin;
      wrapped.forEach((cellLines, index) => {
        const width = colWidths[index];
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(255, 255, 255);
        doc.rect(x, cursorY, width, rowHeight, "FD");
        doc.setFontSize(10.5);
        doc.setTextColor(index === 0 ? 15 : 51, index === 0 ? 23 : 65, index === 0 ? 42 : 85);
        doc.text(cellLines, x + 2, cursorY + 4.5);
        x += width;
      });
      cursorY += rowHeight;
    });
  };

  doc.setFillColor(185, 28, 28);
  doc.roundedRect(margin, 10, contentWidth, 18, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(labels.exportedAnswerTitle, margin + 4, 21);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.text(
    `${labels.generatedOn} ${new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
    margin,
    36,
  );

  cursorY = 46;
  writeSectionLabel(labels.question);
  writeParagraph(question || labels.questionUnavailable);

  cursorY += 2;
  writeSectionLabel(labels.response);
  if (!blocks.length) {
    writeParagraph(answer || labels.responseUnavailable);
  } else {
    blocks.forEach((block) => {
      if (block.type === "paragraph") {
        writeParagraph(block.text);
        cursorY += 1.5;
        return;
      }
      if (block.type === "list") {
        drawList(block.items);
        cursorY += 1.5;
        return;
      }
      drawTable(block.header, block.rows);
      cursorY += 2;
    });
  }

  if (sourceFile?.filename) {
    cursorY += 2;
    writeSectionLabel(labels.sourceDocument);
    writeParagraph(sourceFile.filename, 10, [51, 65, 85]);
  }

  doc.save(buildPdfFilename(question));
}

export default function AskQuestionPage() {
  const navigate = useNavigate();
  const { language, locale } = useI18n();
  const labels: AskQuestionLabels = askQuestionCopy[language as UiLanguage];
  const [question, setQuestion] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [conversationBootstrapping, setConversationBootstrapping] = useState(false);
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
  const [responseMode, setResponseMode] = useState<ResponseMode>("DETAILED");
  const [conversationSearch, setConversationSearch] = useState("");
  const [feedbackByQuestionId, setFeedbackByQuestionId] = useState<Record<string, "up" | "down">>({});

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loading = pendingRequests > 0;

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
    setFeedbackByQuestionId(readFeedbackStore());
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

  const normalizedConversationSearch = conversationSearch.trim().toLocaleLowerCase();

  const filteredMessages = useMemo(
    () =>
      normalizedConversationSearch
        ? messages.filter((message) => message.text.toLocaleLowerCase().includes(normalizedConversationSearch))
        : messages,
    [messages, normalizedConversationSearch],
  );

  const activeConversationTitle = useMemo(() => {
    const historyTitle = historyItems.find((item) => item.id === activeHistoryId)?.title?.trim();
    if (historyTitle) return historyTitle;

    const firstUserMessage = messages.find((message) => message.role === "user")?.text.trim();
    if (firstUserMessage) return firstUserMessage.slice(0, 80);

    return labels.conversationFileFallback;
  }, [activeHistoryId, historyItems, messages]);

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
    setConversationSearch("");
    resetSuggestions();
    setError(null);
    setActiveHistoryId(null);
  }

  async function openHistoryItem(item: ConversationSummary) {
    try {
      setError(null);
      setActiveHistoryId(item.id);
      setConversationId(item.id);
      setConversationSearch("");
      resetSuggestions();
      const data = await getConversationMessages(item.id);
      setMessages(fromConversationMessages(data, locale));
    } catch {
      setError(labels.loadConversationError);
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
      publishSnackbar({ variant: "success", message: labels.conversationArchived });
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
      publishSnackbar({ variant: "success", message: labels.conversationRestored });
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
      publishSnackbar({ variant: "success", message: labels.conversationRenamed });
    } finally {
      setRenamingId(null);
    }
  }


  async function handleDeleteConversation(target: ConversationSummary) {
    const ok = window.confirm(labels.deleteConfirm(target.title));
    if (!ok) return;
    try {
      setDeletingId(target.id);
      await deleteConversation(target.id);
      setHistoryItems((current) => current.filter((item) => item.id !== target.id));
      setMenuConversationId(null);
      if (activeHistoryId === target.id || conversationId === target.id) {
        startNewQuestion();
      }
      publishSnackbar({ variant: "success", message: labels.conversationDeleted });
    } finally {
      setDeletingId(null);
    }
  }


  async function handleCopyResponse(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      publishSnackbar({ variant: "success", message: labels.responseCopied });
    } catch {
      publishSnackbar({ variant: "warning", message: labels.copyUnavailable });
    }
  }

  function handleFeedback(questionId: string, value: "up" | "down") {
    setFeedbackByQuestionId((current) => {
      const next = { ...current };
      if (current[questionId] === value) {
        delete next[questionId];
      } else {
        next[questionId] = value;
      }
      writeFeedbackStore(next);
      return next;
    });
    publishSnackbar({ variant: "success", message: value === "up" ? labels.positiveThanks : labels.feedbackSaved });
  }

  function handleExportConversation(format: "pdf" | "txt") {
    if (messages.length === 0) {
      publishSnackbar({ variant: "warning", message: labels.nothingToExport });
      return;
    }

    if (format === "pdf") {
      downloadConversationPdf(activeConversationTitle, messages, locale, labels);
      publishSnackbar({ variant: "success", message: labels.conversationPdfExported });
      return;
    }

    downloadConversationText(activeConversationTitle, messages, locale, labels);
    publishSnackbar({ variant: "success", message: labels.conversationTextExported });
  }

  function handleReportResponse(questionText: string, answerText: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CHAT_CLAIM_DRAFT_KEY,
        JSON.stringify({
          category: "CHATBOT",
          priority: "NORMAL",
          subject: `${labels.reportSubject} - ${questionText.slice(0, 80)}`,
          description: `${labels.askedQuestion} : ${questionText}

${labels.answerToReview} :
${answerText}`,
          pageContext: "/user/chat",
        }),
      );
    }
    publishSnackbar({ variant: "info", message: labels.claimDraftPrepared });
    navigate("/user/reclamations");
  }

  async function onAsk(prefilledQuestion?: string) {
    const currentQuestion = (prefilledQuestion ?? question).trim();
    if (!currentQuestion) return;
    if (!conversationId && conversationBootstrapping) return;

    const requestConversationId = conversationId;
    const bootstrapping = !requestConversationId;

    try {
      setPendingRequests((prev) => prev + 1);
      if (bootstrapping) {
        setConversationBootstrapping(true);
      }

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: currentQuestion,
        time: nowAsTime(locale),
      };

      setMessages((prev) => [...prev, userMessage]);
      setQuestion("");
      resetSuggestions();

      const res = await askQuestion({ question: currentQuestion, conversationId: requestConversationId, responseMode });

      setConversationId((current) => current ?? res.conversationId);
      setActiveHistoryId(res.conversationId);

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: sanitizeAnswerText(res.answer),
        time: nowAsTime(locale),
        questionId: res.questionId,
        sourceFile: res.sourceFile ?? null,
        sources: res.sources ?? [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      await refreshHistory();
    } finally {
      setPendingRequests((prev) => Math.max(0, prev - 1));
      if (bootstrapping) {
        setConversationBootstrapping(false);
      }
    }
  }

  return (
    <div className="flex h-[calc(107vh-140px)] min-h-[calc(107vh-140px)] gap-4 ">
      <AskQuestionSidebar
        visible={sidebarOpen}
        labels={labels}
        archivedCount={archivedHistory.length}
        visibleHistory={visibleHistory}
        menuConversationId={menuConversationId}
        archivingId={archivingId}
        deletingId={deletingId}
        Icon={Icon}
        formatDayLabel={(dateString) => formatDayLabel(dateString, labels)}
        startNewQuestion={startNewQuestion}
        openArchives={() => setArchivesModalOpen(true)}
        openHistoryItem={(item) => void openHistoryItem(item)}
        toggleMenuConversation={(id) => setMenuConversationId((current) => (current === id ? null : id))}
        openRenameModal={openRenameModal}
        handleArchiveConversation={(item) => void handleArchiveConversation(item)}
        handleDeleteConversation={(item) => void handleDeleteConversation(item)}
      />

      <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <AskQuestionChatHeader
          labels={labels}
          language={language}
          messages={messages}
          conversationSearch={conversationSearch}
          normalizedConversationSearch={normalizedConversationSearch}
          filteredMessagesCount={filteredMessages.length}
          Icon={Icon}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onExport={handleExportConversation}
          onSearchChange={setConversationSearch}
          onClearSearch={() => setConversationSearch("")}
        />

        <AskQuestionMessagesPane
          messages={messages}
          filteredMessages={filteredMessages}
          normalizedConversationSearch={normalizedConversationSearch}
          conversationSearch={conversationSearch}
          labels={labels}
          loading={loading}
          feedbackByQuestionId={feedbackByQuestionId}
          bottomRef={bottomRef}
          Icon={Icon}
          renderAssistantContent={(text, searchQuery) => renderAssistantContent(text, searchQuery, labels)}
          renderHighlightedText={renderHighlightedText}
          onCopyResponse={handleCopyResponse}
          onDownloadAnswerPdf={(questionText, answerText, sourceFile) => downloadAnswerPdf(questionText, answerText, sourceFile, locale, labels)}
          onFeedback={(questionId, direction) => handleFeedback(questionId, direction)}
          onReportResponse={handleReportResponse}
        />

        <AskQuestionComposer
          labels={labels}
          responseMode={responseMode}
          question={question}
          suggestionsOpen={suggestionsOpen}
          suggestionsLoading={suggestionsLoading}
          suggestions={suggestions}
          hasSuggestionSearch={hasSuggestionSearch}
          Icon={Icon}
          onResponseModeChange={setResponseMode}
          onQuestionChange={setQuestion}
          onAsk={() => void onAsk()}
          onFocus={() => {
            if (countTypedWords(question) >= 3) {
              setSuggestionsOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setSuggestionsOpen(false), 120);
          }}
          onSuggestionClick={setQuestion}
          setSuggestionsOpen={setSuggestionsOpen}
          askDisabled={!question.trim() || (!conversationId && conversationBootstrapping)}
        />
      </section>

      <AskQuestionRenameModal
        open={renameModalOpen}
        labels={labels}
        renameValue={renameValue}
        renameTarget={renameTarget}
        renamingId={renamingId}
        onClose={() => {
          setRenameModalOpen(false);
          setRenameTarget(null);
          setRenameValue("");
        }}
        onChange={setRenameValue}
        onSubmit={() => void submitRename()}
      />

      <AskQuestionArchivesModal
        open={archivesModalOpen}
        labels={labels}
        archivedHistory={archivedHistory}
        archivingId={archivingId}
        formatDayLabel={(dateString) => formatDayLabel(dateString, labels)}
        onClose={() => setArchivesModalOpen(false)}
        onRestore={(item) => void handleRestoreConversation(item)}
      />
    </div>
  );
}












