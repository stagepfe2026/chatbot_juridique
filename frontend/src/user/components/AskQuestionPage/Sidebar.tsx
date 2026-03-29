import type { ConversationSummary } from "../../../models/conversation.models";
import type { AskQuestionLabelsLike, IconComponent } from "./types";

export default function AskQuestionSidebar({
  visible,
  labels,
  archivedCount,
  visibleHistory,
  menuConversationId,
  archivingId,
  deletingId,
  Icon,
  formatDayLabel,
  startNewQuestion,
  openArchives,
  openHistoryItem,
  toggleMenuConversation,
  openRenameModal,
  handleArchiveConversation,
  handleDeleteConversation,
}: {
  visible: boolean;
  labels: AskQuestionLabelsLike;
  archivedCount: number;
  visibleHistory: ConversationSummary[];
  menuConversationId: string | null;
  archivingId: string | null;
  deletingId: string | null;
  Icon: IconComponent;
  formatDayLabel: (dateString: string) => string;
  startNewQuestion: () => void;
  openArchives: () => void;
  openHistoryItem: (item: ConversationSummary) => void;
  toggleMenuConversation: (id: string) => void;
  openRenameModal: (item: ConversationSummary) => void;
  handleArchiveConversation: (item: ConversationSummary) => void;
  handleDeleteConversation: (item: ConversationSummary) => void;
}) {
  if (!visible) return null;

  return (
    <aside className="hidden lg:flex w-72 shrink-0 flex-col border border-slate-200 bg-white p-3 sticky top-6 h-[calc(104vh-120px)] overflow-y-auto rounded-xl shadow-lg">
      <div className="grid gap-2">
        <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold hover:bg-red-50 hover:text-red-600" onClick={startNewQuestion}>
          <Icon><path d="M12 5v14"/><path d="M5 12h14"/></Icon>
          {labels.newConversation}
        </button>
        <button className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={openArchives}>
          <span>{labels.myArchives}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{archivedCount}</span>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
        <span>{labels.activeConversations}</span>
        <span>{visibleHistory.length}</span>
      </div>

      <div className="mt-3 space-y-2">
        {visibleHistory.map((item) => (
          <div key={item.id} className="group relative rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-50">
            <button className="block w-full appearance-none border-0 bg-transparent p-0 pr-8 text-left shadow-none outline-none" onClick={() => openHistoryItem(item)}>
              <div className="truncate font-medium text-slate-800">{item.title}</div>
              <div className="text-xs text-slate-400">{formatDayLabel(item.updatedAt)}</div>
            </button>
            <div className="absolute right-2 top-2">
              <button type="button" onClick={() => toggleMenuConversation(item.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100" aria-label={labels.actionsFor + ' ' + item.title}>
                <Icon size={15}><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></Icon>
              </button>
              {menuConversationId === item.id && (
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  <button type="button" onClick={() => openRenameModal(item)} className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50">{labels.rename}</button>
                  <button type="button" disabled={archivingId === item.id} onClick={() => handleArchiveConversation(item)} className="w-full px-3 py-2 text-left text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60">{archivingId === item.id ? labels.archiving : labels.archive}</button>
                  <button type="button" disabled={deletingId === item.id} onClick={() => handleDeleteConversation(item)} className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60">{deletingId === item.id ? labels.deleting : labels.delete}</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {visibleHistory.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-400">{labels.noActiveConversations}</div>}
      </div>
    </aside>
  );
}
