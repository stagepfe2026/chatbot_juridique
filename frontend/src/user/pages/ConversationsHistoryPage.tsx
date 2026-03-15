import { useEffect, useState } from "react";
import type { ConversationSummary } from "../../models/conversation.models";
import { listMyConversations } from "../../services/user.service";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR");
}

export default function ConversationsHistoryPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listMyConversations();
        setConversations(data);
      } catch (e: unknown) {
        const message =
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "Erreur de chargement des conversations.")
            : "Erreur de chargement des conversations.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Mes conversations</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">Retrouvez vos anciens échanges avec l'assistant.</p>
      </div>

      {loading && <div className="rounded-2xl border border-white/80 bg-white/85 px-5 py-8 text-sm font-semibold text-slate-500 shadow-sm">Chargement des conversations...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {!loading && !error && conversations.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center text-sm font-semibold text-slate-500">Aucune conversation enregistrée pour le moment.</div>}

      {!loading && !error && conversations.length > 0 && (
        <div className="grid gap-4">
          {conversations.map((item) => (
            <section
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-red-200 transition"
              key={item.id}
            >
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.preview || item.summary || "-"}</p>
              <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <div>Messages: {item.messageCount}</div>
                <div>Créée le: {formatDate(item.createdAt)}</div>
                <div>Maj le: {formatDate(item.updatedAt)}</div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}