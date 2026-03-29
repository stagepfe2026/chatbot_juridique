import type { ReactNode, RefObject } from "react";
import type { SourceFile } from "../../../models/chat.models";
import type { AskQuestionLabelsLike, ChatMessageLike, IconComponent } from "./types";

export default function AskQuestionMessagesPane({
  messages,
  filteredMessages,
  normalizedConversationSearch,
  conversationSearch,
  labels,
  loading,
  feedbackByQuestionId,
  bottomRef,
  Icon,
  renderAssistantContent,
  renderHighlightedText,
  onCopyResponse,
  onDownloadAnswerPdf,
  onFeedback,
  onReportResponse,
}: {
  messages: ChatMessageLike[];
  filteredMessages: ChatMessageLike[];
  normalizedConversationSearch: string;
  conversationSearch: string;
  labels: AskQuestionLabelsLike;
  loading: boolean;
  feedbackByQuestionId: Record<string, "up" | "down">;
  bottomRef: RefObject<HTMLDivElement | null>;
  Icon: IconComponent;
  renderAssistantContent: (text: string, searchQuery: string) => ReactNode;
  renderHighlightedText: (text: string, searchQuery: string) => ReactNode;
  onCopyResponse: (text: string) => void;
  onDownloadAnswerPdf: (question: string, answer: string, sourceFile?: SourceFile | null) => void;
  onFeedback: (questionId: string, direction: "up" | "down") => void;
  onReportResponse: (question: string, answer: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 scroll-smooth">
      {filteredMessages.length > 0 ? filteredMessages.map((message) => {
        const sourceIndex = messages.findIndex((item) => item.id === message.id);
        const relatedQuestion = message.role === "assistant" ? [...messages.slice(0, sourceIndex)].reverse().find((item) => item.role === "user")?.text ?? "" : "";

        return (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-2xl rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "bg-red-600 text-white shadow-lg" : "border border-slate-200 bg-slate-50 text-slate-800 shadow-lg"}`}>
              {message.role === "assistant" ? renderAssistantContent(message.text, conversationSearch) : <div className="whitespace-pre-wrap">{renderHighlightedText(message.text, conversationSearch)}</div>}
              {message.role === "assistant" && (
                <div className="mt-3 grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => onCopyResponse(message.text)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                      <Icon size={14}><rect x="9" y="9" width="10" height="10" rx="2" /><path d="M5 15V7a2 2 0 0 1 2-2h8" /></Icon>
                      <span>{labels.copy}</span>
                    </button>
                    <button type="button" onClick={() => onDownloadAnswerPdf(relatedQuestion, message.text, message.sourceFile)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                      <Icon size={14}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Icon>
                      <span>PDF</span>
                    </button>
                    {message.sourceFile && (
                      <a className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" href={message.sourceFile.downloadUrl} download={message.sourceFile.filename}>
                        <Icon size={14}><path d="M8 3h6l4 4v14H6V3z" /><path d="M14 3v4h4" /></Icon>
                        <span className="truncate">{labels.sourceDocument}</span>
                      </a>
                    )}
                  </div>

                  {message.questionId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => onFeedback(message.questionId!, "up")} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${feedbackByQuestionId[message.questionId] === "up" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                        <Icon size={14}><path d="M7 11v8" /><path d="M14 5.5 13 11h5.5a2 2 0 0 1 2 2v1a2 2 0 0 1-.2.9l-2.1 4.2a2 2 0 0 1-1.8 1.1H7V11l4.8-6.2a1 1 0 0 1 1.8.7Z" /></Icon>
                        <span>{labels.helpful}</span>
                      </button>
                      <button type="button" onClick={() => onFeedback(message.questionId!, "down")} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${feedbackByQuestionId[message.questionId] === "down" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"}`}>
                        <Icon size={14}><path d="M17 13V5" /><path d="M10 18.5 11 13H5.5a2 2 0 0 1-2-2v-1a2 2 0 0 1 .2-.9l2.1-4.2a2 2 0 0 1 1.8-1.1H17V13l-4.8 6.2a1 1 0 0 1-1.8-.7Z" /></Icon>
                        <span>{labels.notHelpful}</span>
                      </button>
                      <button type="button" onClick={() => onReportResponse(relatedQuestion, message.text)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                        <Icon size={14}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></Icon>
                        <span>{labels.report}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              <div className="mt-1 text-[10px] opacity-70">{message.time}</div>
            </div>
          </div>
        );
      }) : normalizedConversationSearch ? <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">{labels.noSearchResults}</div> : null}

      {loading && <div className="text-sm text-slate-400">IA en train de répondre...</div>}
      <div ref={bottomRef} />
    </div>
  );
}



