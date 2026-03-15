import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSources } from "../../services/user.service";
import type { SourceItem } from "../../models/chat.models";

export default function SourcesPage() {
  const { questionId } = useParams();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!questionId?.trim()) {
        setError("Question invalide.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const res = await getSources(questionId);
        setSources(res);
      } catch (e: unknown) {
        const message =
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "Erreur de chargement des sources.")
            : "Erreur de chargement des sources.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [questionId]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Sources</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Justificatifs utilises pour generer la reponse.</p>
        </div>
        <Link to="/user/chat" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
          Retour au chat
        </Link>
      </div>

      {loading && <div className="rounded-[28px] border border-white/80 bg-white/85 px-5 py-8 text-sm font-semibold text-slate-500 shadow-sm">Chargement des sources...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {!loading && !error && sources.length === 0 && <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center text-sm font-semibold text-slate-500">Aucune source trouvee.</div>}

      {!loading && !error && sources.length > 0 && (
        <div className="grid gap-4">
          {sources.map((source) => (
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-sm" key={`${source.documentId}-${source.excerpt.slice(0, 20)}`}>
              <h3 className="text-xl font-black tracking-tight text-slate-900">{source.title}</h3>
              <div className="mt-2 text-sm font-semibold text-slate-500">Document #{source.documentId}</div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{source.excerpt}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
