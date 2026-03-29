import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSources } from "../../services/user.service";
import type { SourceItem } from "../../models/chat.models";
import { useI18n } from "../../i18n/I18nContext";

const labels = {
  fr: { invalidQuestion: "Question invalide.", loadError: "Erreur de chargement des sources.", title: "Sources", subtitle: "Justificatifs utilises pour generer la reponse.", back: "Retour au chat", loading: "Chargement des sources...", empty: "Aucune source trouvee.", document: "Document" },
  en: { invalidQuestion: "Invalid question.", loadError: "Error while loading sources.", title: "Sources", subtitle: "Evidence used to generate the answer.", back: "Back to chat", loading: "Loading sources...", empty: "No sources found.", document: "Document" },
  ar: { invalidQuestion: "?????? ??? ????.", loadError: "??? ????? ????? ???????.", title: "???????", subtitle: "??????? ????????? ?????? ??????.", back: "?????? ??? ???????", loading: "???? ????? ???????...", empty: "?? ??? ?????? ??? ?????.", document: "?????" },
} as const;

export default function SourcesPage() {
  const { language, t } = useI18n();
  const l = labels[language];
  const { questionId } = useParams();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!questionId?.trim()) {
        setError(l.invalidQuestion);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await getSources(questionId);
        setSources(res);
      } catch (e: unknown) {
        const message = typeof e === "object" && e !== null && "message" in e ? String((e as { message?: unknown }).message ?? l.loadError) : l.loadError;
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [questionId, l.invalidQuestion, l.loadError]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("claims.userArea")}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{l.title}</h1><p className="mt-2 text-sm font-medium text-slate-500">{l.subtitle}</p></div>
        <Link to="/user/chat" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">{l.back}</Link>
      </div>
      {loading && <div className="rounded-[28px] border border-white/80 bg-white/85 px-5 py-8 text-sm font-semibold text-slate-500 shadow-lg">{l.loading}</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {!loading && !error && sources.length === 0 && <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center text-sm font-semibold text-slate-500">{l.empty}</div>}
      {!loading && !error && sources.length > 0 && <div className="grid gap-4">{sources.map((source) => <section className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-lg" key={`${source.documentId}-${source.excerpt.slice(0, 20)}`}><h3 className="text-xl font-black tracking-tight text-slate-900">{source.title}</h3><div className="mt-2 text-sm font-semibold text-slate-500">{l.document} #{source.documentId}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{source.excerpt}</p></section>)}</div>}
    </div>
  );
}


