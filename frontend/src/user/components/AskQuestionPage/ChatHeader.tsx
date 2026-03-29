import type { AskQuestionLabelsLike, ChatMessageLike, IconComponent } from "./types";

export default function AskQuestionChatHeader({
  labels,
  language,
  messages,
  conversationSearch,
  normalizedConversationSearch,
  filteredMessagesCount,
  Icon,
  onToggleSidebar,
  onExport,
  onSearchChange,
  onClearSearch,
}: {
  labels: AskQuestionLabelsLike;
  language: string;
  messages: ChatMessageLike[];
  conversationSearch: string;
  normalizedConversationSearch: string;
  filteredMessagesCount: number;
  Icon: IconComponent;
  onToggleSidebar: () => void;
  onExport: (format: "pdf" | "txt") => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
}) {
  return (
    <div className="border-b border-slate-200 px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-red-900">{labels.legalAssistant}</div>
          <div className="text-xs text-slate-500">Posez vos questions juridiques</div>
        </div>
        <button className="rounded-lg border border-slate-200 p-2 hover:bg-red-50 hover:text-red-600" onClick={onToggleSidebar}>
          <Icon><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></Icon>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onExport("pdf")} disabled={messages.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Icon size={14}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Icon>
          <span>{language === "fr" ? "Exporter PDF" : language === "en" ? "Export PDF" : "????? PDF"}</span>
        </button>
        <button type="button" onClick={() => onExport("txt")} disabled={messages.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Icon size={14}><path d="M8 7h8" /><path d="M8 12h8" /><path d="M8 17h5" /><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></Icon>
          <span>{language === "fr" ? "Exporter TXT" : language === "en" ? "Export TXT" : "????? TXT"}</span>
        </button>
        <div className="relative min-w-[220px] flex-1">
          <input type="search" value={conversationSearch} onChange={(e) => onSearchChange(e.target.value)} placeholder={labels.searchConversation} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pl-9 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white" />
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon size={14}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></Icon></div>
        </div>
        {normalizedConversationSearch ? (
          <>
            <div className="text-xs text-slate-500">{filteredMessagesCount} resultat{filteredMessagesCount > 1 ? "s" : ""}</div>
            <button type="button" onClick={onClearSearch} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Effacer</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
