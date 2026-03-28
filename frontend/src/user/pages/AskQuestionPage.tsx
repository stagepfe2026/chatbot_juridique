import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import jsPDF from "jspdf";
import type { ResponseMode, SourceFile, SourceItem } from "../../models/chat.models";
import type { ConversationMessage, ConversationSummary } from "../../models/conversation.models";
import {
  archiveConversation,
  askQuestion,
  getSources,
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
  sources?: SourceItem[];
  followUpSuggestions?: string[];
  followUpStatus?: "idle" | "loading" | "ready" | "error";
};
const CHAT_FEEDBACK_KEY = "chat-message-feedback";
const CHAT_CLAIM_DRAFT_KEY = "chat-claim-draft";

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

function renderAssistantContent(text: string, searchQuery = ""): ReactNode {
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
        <div key={`table-${blocks.length}`} className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reponse structuree</div>
            <div className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
              {rows.length} ligne{rows.length > 1 ? "s" : ""}
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

function fromConversationMessages(messages: ConversationMessage[]): ChatMessage[] {
  return messages.map((item) => ({
    id: item.id,
    role: item.role,
    text: item.role === "assistant" ? sanitizeAnswerText(item.content) : item.content,
    time: new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    questionId: item.questionId ?? null,
    sourceFile: item.sourceFile ?? null,
    sources: [],
    followUpSuggestions: [],
    followUpStatus: item.role === "assistant" ? "idle" : "ready",
  }));
}

function normalizeFollowUpSuggestions(sourceQuestion: string, items: string[], limit = 3): string[] {
  const normalizedSource = sourceQuestion.trim().toLocaleLowerCase();
  const unique = new Set<string>();

  for (const item of items) {
    const next = item.trim();
    if (!next) continue;
    if (next.toLocaleLowerCase() === normalizedSource) continue;
    unique.add(next);
    if (unique.size >= limit) break;
  }

  return [...unique];
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

function buildConversationExportFilename(title: string, extension: "pdf" | "txt"): string {
  const base = slugifyFilenamePart(title).slice(0, 60) || "conversation-juridique";
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

function sourceMetaLabel(source: SourceItem): string {
  const parts = [source.section, source.page ? `Page ${source.page}` : null].filter(Boolean);
  return parts.join(" ? ");
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

function downloadConversationText(title: string, messages: ChatMessage[]): void {
  const exportedAt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const lines = [
    `Conversation : ${title}`,
    `Exportee le : ${exportedAt}`,
    "",
    ...messages.flatMap((message) => [
      `[${message.time}] ${message.role === "user" ? "Utilisateur" : "Assistant"}`,
      message.text,
      message.sourceFile?.filename ? `Document source : ${message.sourceFile.filename}` : "",
      "",
    ]),
  ];

  downloadFile(buildConversationExportFilename(title, "txt"), lines.join("\n"), "text/plain;charset=utf-8");
}

function downloadConversationPdf(title: string, messages: ChatMessage[]): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const safeTitle = title || "Conversation juridique";
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
    doc.text("Assistant Juridique", margin, 12);
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
    doc.text(message.role === "user" ? "Utilisateur" : "Assistant", margin, cursorY);

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
      writeParagraph(`Document source : ${message.sourceFile.filename}`, 9.5, [100, 116, 139]);
    }

    cursorY += 4;
  };

  drawPageChrome();

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text("Export de conversation", margin, 28);

  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(safeTitle, contentWidth);
  doc.text(titleLines, margin, 36);

  cursorY = 48;
  writeParagraph(`Date d'export : ${generatedAt}`, 9.5, [71, 85, 105]);
  writeParagraph(`Nombre de messages : ${messages.length}`, 9.5, [71, 85, 105]);
  cursorY += 2;

  messages.forEach((message) => {
    drawMessage(message);
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 8.5, { align: "right" });
  }

  doc.save(buildConversationExportFilename(title, "pdf"));
}

function downloadAnswerPdf(question: string, answer: string, sourceFile?: SourceFile | null): void {
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
  doc.text("Assistant Juridique - Reponse exportee", margin + 4, 21);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(10);
  doc.text(
    `Genere le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
    margin,
    36,
  );

  cursorY = 46;
  writeSectionLabel("Question");
  writeParagraph(question || "Question non disponible.");

  cursorY += 2;
  writeSectionLabel("Reponse");
  if (!blocks.length) {
    writeParagraph(answer || "Reponse non disponible.");
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
    writeSectionLabel("Document source");
    writeParagraph(sourceFile.filename, 10, [51, 65, 85]);
  }

  doc.save(buildPdfFilename(question));
}

export default function AskQuestionPage() {
  const navigate = useNavigate();
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
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [sourcesLoadingByQuestionId, setSourcesLoadingByQuestionId] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    const targetIndex = messages.findIndex((message, index) => {
      if (message.role !== "assistant" || message.followUpStatus !== "idle") return false;
      return Boolean([...messages.slice(0, index)].reverse().find((item) => item.role === "user")?.text.trim());
    });

    if (targetIndex < 0) return;
    const targetMessage = messages[targetIndex];
    const relatedQuestion = [...messages.slice(0, targetIndex)].reverse().find((item) => item.role === "user")?.text ?? "";
    if (!targetMessage) return;

    loadFollowUpSuggestions(targetMessage.id, relatedQuestion);
  }, [messages]);

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

    return "conversation-juridique";
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

  function loadFollowUpSuggestions(messageId: string, sourceQuestion: string) {
    const trimmedQuestion = sourceQuestion.trim();
    if (countTypedWords(trimmedQuestion) < 3) {
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, followUpSuggestions: [], followUpStatus: "ready" } : item,
        ),
      );
      return;
    }

    setMessages((current) =>
      current.map((item) => (item.id === messageId ? { ...item, followUpStatus: "loading" } : item)),
    );

    void getQuestionSuggestions(trimmedQuestion, 3)
      .then((items) => {
        const nextSuggestions = normalizeFollowUpSuggestions(trimmedQuestion, items, 3);
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId
              ? { ...item, followUpSuggestions: nextSuggestions, followUpStatus: "ready" }
              : item,
          ),
        );
      })
      .catch(() => {
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId ? { ...item, followUpSuggestions: [], followUpStatus: "error" } : item,
          ),
        );
      });
  }

  async function openHistoryItem(item: ConversationSummary) {
    try {
      setError(null);
      setActiveHistoryId(item.id);
      setConversationId(item.id);
      setConversationSearch("");
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


  async function handleCopyResponse(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      publishSnackbar({ variant: "success", message: "Reponse copiee." });
    } catch {
      publishSnackbar({ variant: "warning", message: "Copie impossible sur ce navigateur." });
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
    publishSnackbar({ variant: "success", message: value === "up" ? "Merci pour votre retour positif." : "Retour enregistre." });
  }

  function handleExportConversation(format: "pdf" | "txt") {
    if (messages.length === 0) {
      publishSnackbar({ variant: "warning", message: "Aucune conversation a exporter." });
      return;
    }

    if (format === "pdf") {
      downloadConversationPdf(activeConversationTitle, messages);
      publishSnackbar({ variant: "success", message: "Conversation exportee en PDF." });
      return;
    }

    downloadConversationText(activeConversationTitle, messages);
    publishSnackbar({ variant: "success", message: "Conversation exportee en texte." });
  }

  function handleReportResponse(questionText: string, answerText: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CHAT_CLAIM_DRAFT_KEY,
        JSON.stringify({
          category: "CHATBOT",
          priority: "NORMAL",
          subject: `Signalement reponse chatbot - ${questionText.slice(0, 80)}`,
          description: `Question posee : ${questionText}

Reponse a verifier :
${answerText}`,
          pageContext: "/user/chat",
        }),
      );
    }
    publishSnackbar({ variant: "info", message: "Un brouillon de reclamation a ete prepare." });
    navigate("/user/reclamations");
  }

  async function ensureSourcesLoaded(message: ChatMessage) {
    if (!message.questionId) return;
    if (message.sources && message.sources.length > 0) return;
    if (sourcesLoadingByQuestionId[message.questionId]) return;

    try {
      setSourcesLoadingByQuestionId((current) => ({ ...current, [message.questionId!]: true }));
      const items = await getSources(message.questionId);
      setMessages((current) => current.map((item) => (item.questionId === message.questionId ? { ...item, sources: items } : item)));
    } catch {
      publishSnackbar({ variant: "warning", message: "Impossible de charger les sources." });
    } finally {
      setSourcesLoadingByQuestionId((current) => ({ ...current, [message.questionId!]: false }));
    }
  }

  async function toggleSources(message: ChatMessage) {
    if (!message.questionId) return;
    const next = !expandedSources[message.questionId];
    setExpandedSources((current) => ({ ...current, [message.questionId!]: next }));
    if (next) {
      await ensureSourcesLoaded(message);
    }
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
        time: nowAsTime(),
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
        time: nowAsTime(),
        questionId: res.questionId,
        sourceFile: res.sourceFile ?? null,
        sources: res.sources ?? [],
        followUpSuggestions: [],
        followUpStatus: "idle",
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
      {sidebarOpen && (
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border border-slate-200 bg-white p-3 sticky top-6 h-[calc(104vh-120px)] overflow-y-auto rounded-xl">
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
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportConversation("pdf")}
              disabled={messages.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon size={14}>
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </Icon>
              <span>Exporter PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportConversation("txt")}
              disabled={messages.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon size={14}>
                <path d="M8 7h8" />
                <path d="M8 12h8" />
                <path d="M8 17h5" />
                <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
              </Icon>
              <span>Exporter TXT</span>
            </button>
            <div className="relative min-w-[220px] flex-1">
              <input
                type="search"
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder="Rechercher dans la conversation"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pl-9 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
              />
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Icon size={14}>
                  <circle cx="11" cy="11" r="6" />
                  <path d="m20 20-3.5-3.5" />
                </Icon>
              </div>
            </div>
            {normalizedConversationSearch ? (
              <>
                <div className="text-xs text-slate-500">
                  {filteredMessages.length} resultat{filteredMessages.length > 1 ? "s" : ""}
                </div>
                <button
                  type="button"
                  onClick={() => setConversationSearch("")}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Effacer
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 scroll-smooth">          {filteredMessages.length > 0 ? filteredMessages.map((message) => {
            const sourceIndex = messages.findIndex((item) => item.id === message.id);
            const relatedQuestion =
              message.role === "assistant"
                ? [...messages.slice(0, sourceIndex)].reverse().find((item) => item.role === "user")?.text ?? ""
                : "";

            return (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-2xl rounded-xl px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-red-600 text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-800 shadow-sm"
                }`}>
                  {message.role === "assistant" ? renderAssistantContent(message.text, conversationSearch) : <div className="whitespace-pre-wrap">{renderHighlightedText(message.text, conversationSearch)}</div>}
                  {message.role === "assistant" && (
                    <div className="mt-3 grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyResponse(message.text)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Icon size={14}>
                            <rect x="9" y="9" width="10" height="10" rx="2" />
                            <path d="M5 15V7a2 2 0 0 1 2-2h8" />
                          </Icon>
                          <span>Copier</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadAnswerPdf(relatedQuestion, message.text, message.sourceFile)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Icon size={14}>
                            <path d="M12 3v12" />
                            <path d="m7 10 5 5 5-5" />
                            <path d="M5 21h14" />
                          </Icon>
                          <span>PDF</span>
                        </button>
                        {message.questionId ? (
                          <button
                            type="button"
                            onClick={() => void toggleSources(message)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <Icon size={14}>
                              <path d="M4 6h16" />
                              <path d="M4 12h16" />
                              <path d="M4 18h10" />
                            </Icon>
                            <span>{expandedSources[message.questionId] ? "Masquer les sources" : "Voir les sources"}</span>
                          </button>
                        ) : null}
                        {message.sourceFile && (
                          <a
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            href={message.sourceFile.downloadUrl}
                            download={message.sourceFile.filename}
                          >
                            <Icon size={14}>
                              <path d="M8 3h6l4 4v14H6V3z" />
                              <path d="M14 3v4h4" />
                            </Icon>
                            <span className="truncate">Document source</span>
                          </a>
                        )}
                      </div>

                      {message.questionId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleFeedback(message.questionId!, "up")}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${feedbackByQuestionId[message.questionId] === "up" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"}`}
                          >
                            <Icon size={14}>
                              <path d="M7 11v8" />
                              <path d="M14 5.5 13 11h5.5a2 2 0 0 1 2 2v1a2 2 0 0 1-.2.9l-2.1 4.2a2 2 0 0 1-1.8 1.1H7V11l4.8-6.2a1 1 0 0 1 1.8.7Z" />
                            </Icon>
                            <span>Utile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(message.questionId!, "down")}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${feedbackByQuestionId[message.questionId] === "down" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"}`}
                          >
                            <Icon size={14}>
                              <path d="M17 13V5" />
                              <path d="M10 18.5 11 13H5.5a2 2 0 0 1-2-2v-1a2 2 0 0 1 .2-.9l2.1-4.2a2 2 0 0 1 1.8-1.1H17V13l-4.8 6.2a1 1 0 0 1-1.8-.7Z" />
                            </Icon>
                            <span>Non utile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReportResponse(relatedQuestion, message.text)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <Icon size={14}>
                              <path d="M12 9v4" />
                              <path d="M12 17h.01" />
                              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                            </Icon>
                            <span>Signaler</span>
                          </button>
                        </div>
                      ) : null}

                      {message.role === "assistant" && relatedQuestion ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Questions suggerees</div>
                            {message.followUpSuggestions && message.followUpSuggestions.length > 0 ? (
                              <div className="text-[11px] text-slate-400">{message.followUpSuggestions.length}</div>
                            ) : null}
                          </div>

                          <div className="grid gap-1.5">
                            {message.followUpStatus === "loading" ? (
                              <div className="rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-500">
                                Chargement...
                              </div>
                            ) : message.followUpSuggestions && message.followUpSuggestions.length > 0 ? (
                              message.followUpSuggestions.map((suggestion) => (
                                <button
                                  key={`${message.id}-${suggestion}`}
                                  type="button"
                                  onClick={() => void onAsk(suggestion)}
                                  disabled={loading}
                                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {suggestion}
                                </button>
                              ))
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {message.questionId && expandedSources[message.questionId] ? (
                        <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Sources utilisees</div>
                            <div className="text-[11px] text-slate-400">{message.sources?.length ?? 0} source(s)</div>
                          </div>
                          <div className="mt-3 grid gap-2">
                            {message.questionId && sourcesLoadingByQuestionId[message.questionId] ? (
                              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">Chargement des sources...</div>
                            ) : message.sources && message.sources.length > 0 ? (
                              message.sources.map((source, sourceIndex) => (
                                <div key={`${source.documentId}-${sourceIndex}`} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                                  <div className="text-xs font-bold text-slate-900">{source.title}</div>
                                  {sourceMetaLabel(source) ? <div className="mt-1 text-[11px] font-medium text-slate-400">{sourceMetaLabel(source)}</div> : null}
                                  <p className="mt-2 text-xs leading-5 text-slate-600">{source.excerpt || "Aucun extrait disponible."}</p>
                                  <a href={`/user/chat/sources/${message.questionId}`} className="mt-2 inline-flex text-[11px] font-semibold text-red-600 hover:text-red-700">Consulter le detail des sources</a>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">Aucune source detaillee disponible.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] opacity-70">{message.time}</div>
                </div>
              </div>
            );
          }) : normalizedConversationSearch ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              Aucun message ne correspond a votre recherche.
            </div>
          ) : null}

          {loading && <div className="text-sm text-slate-400">IA en train de répondre...</div>}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Mode de reponse</div>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setResponseMode("SHORT")}
                  className={responseMode === "SHORT" ? "rounded-full border border-red-600 bg-red-600 px-3 py-1 text-[11px] font-bold text-white" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-red-200 hover:text-red-600"}
                >
                  Court
                </button>
                <button
                  type="button"
                  onClick={() => setResponseMode("DETAILED")}
                  className={responseMode === "DETAILED" ? "rounded-full border border-red-600 bg-red-600 px-3 py-1 text-[11px] font-bold text-white" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-red-200 hover:text-red-600"}
                >
                  Detaille
                </button>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">{responseMode === "SHORT" ? "Synthese rapide" : "Reponse complete avec plus d'explications"}</div>
          </div>
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
              disabled={!question.trim() || (!conversationId && conversationBootstrapping)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
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








