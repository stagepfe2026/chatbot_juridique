import type { AskQuestionLabelsLike, IconComponent } from "./types";

export default function AskQuestionComposer({
  labels,
  responseMode,
  question,
  suggestionsOpen,
  suggestionsLoading,
  suggestions,
  hasSuggestionSearch,
  Icon,
  onResponseModeChange,
  onQuestionChange,
  onAsk,
  onFocus,
  onBlur,
  onSuggestionClick,
  setSuggestionsOpen,
  askDisabled,
}: {
  labels: AskQuestionLabelsLike;
  responseMode: "SHORT" | "DETAILED";
  question: string;
  suggestionsOpen: boolean;
  suggestionsLoading: boolean;
  suggestions: string[];
  hasSuggestionSearch: boolean;
  Icon: IconComponent;
  onResponseModeChange: (mode: "SHORT" | "DETAILED") => void;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onSuggestionClick: (suggestion: string) => void;
  setSuggestionsOpen: (open: boolean) => void;
  askDisabled: boolean;
}) {
  return (
    <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{labels.responseMode}</div>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => onResponseModeChange("SHORT")} className={responseMode === "SHORT" ? "rounded-full border border-red-600 bg-red-600 px-3 py-1 text-[11px] font-bold text-white" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-red-200 hover:text-red-600"}>{labels.short}</button>
            <button type="button" onClick={() => onResponseModeChange("DETAILED")} className={responseMode === "DETAILED" ? "rounded-full border border-red-600 bg-red-600 px-3 py-1 text-[11px] font-bold text-white" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-red-200 hover:text-red-600"}>{labels.detailed}</button>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">{responseMode === "SHORT" ? labels.shortSummary : labels.detailedSummary}</div>
      </div>
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-300" rows={2} placeholder={labels.askPlaceholder} value={question} onChange={(e) => onQuestionChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAsk(); } }} />
          {suggestionsOpen && (
            <div className="absolute inset-x-0 bottom-[calc(100%+10px)] z-30 grid gap-1.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)]" role="listbox" aria-label={labels.suggestionsAria}>
              {suggestionsLoading ? <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500">{labels.suggestionsLoading}</div> : suggestions.length > 0 ? suggestions.map((suggestion) => (
                <button key={suggestion} type="button" className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-900 transition hover:-translate-y-px hover:bg-red-50 hover:text-red-700" onMouseDown={(e) => e.preventDefault()} onClick={() => { onSuggestionClick(suggestion); setSuggestionsOpen(false); }}>{suggestion}</button>
              )) : hasSuggestionSearch ? <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500">{labels.noSuggestions}</div> : null}
            </div>
          )}
        </div>
        <button onClick={onAsk} disabled={askDisabled} className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
          <Icon><path d="m22 2-10 10"/><path d="m22 2-7 20-3-9-9-3z"/></Icon>
        </button>
      </div>
    </div>
  );
}

