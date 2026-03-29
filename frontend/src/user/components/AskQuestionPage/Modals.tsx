import type { ConversationSummary } from "../../../models/conversation.models";
import type { AskQuestionLabelsLike } from "./types";

export function AskQuestionRenameModal({ open, labels, renameValue, renameTarget, renamingId, onClose, onChange, onSubmit }: { open: boolean; labels: AskQuestionLabelsLike; renameValue: string; renameTarget: ConversationSummary | null; renamingId: string | null; onClose: () => void; onChange: (value: string) => void; onSubmit: () => void; }) {
  if (!open) return null;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4'>
      <div className='w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl'>
        <div className='text-base font-semibold text-slate-900'>{labels.rename} la conversation</div>
        <div className='mt-1 text-sm text-slate-500'>{labels.renameHint}</div>
        <input autoFocus value={renameValue} onChange={(e) => onChange(e.target.value)} className='mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-300' placeholder={labels.newName} />
        <div className='mt-4 flex justify-end gap-2'>
          <button type='button' onClick={onClose} className='rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'>{labels.cancel}</button>
          <button type='button' disabled={!renameValue.trim() || (renameTarget ? renamingId === renameTarget.id : false)} onClick={onSubmit} className='rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60'>{renameTarget && renamingId === renameTarget.id ? labels.saving : labels.save}</button>
        </div>
      </div>
    </div>
  );
}

export function AskQuestionArchivesModal({ open, labels, archivedHistory, archivingId, formatDayLabel, onClose, onRestore }: { open: boolean; labels: AskQuestionLabelsLike; archivedHistory: ConversationSummary[]; archivingId: string | null; formatDayLabel: (dateString: string) => string; onClose: () => void; onRestore: (item: ConversationSummary) => void; }) {
  if (!open) return null;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4'>
      <div className='w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-base font-semibold text-slate-900'>{labels.myArchives}</div>
            <div className='text-sm text-slate-500'>{labels.archivedCount(archivedHistory.length)}</div>
          </div>
          <button type='button' onClick={onClose} className='rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50'>{labels.close}</button>
        </div>
        <div className='mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1'>
          {archivedHistory.length === 0 && <div className='rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400'>{labels.noArchived}</div>}
          {archivedHistory.map((item) => (
            <div key={item.id} className='flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2'>
              <div className='min-w-0 pr-3'>
                <div className='truncate text-sm font-medium text-slate-800'>{item.title}</div>
                <div className='text-xs text-slate-400'>{formatDayLabel(item.updatedAt)}</div>
              </div>
              <button type='button' disabled={archivingId === item.id} onClick={() => onRestore(item)} className='rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60'>{archivingId === item.id ? labels.restoring : labels.restore}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
