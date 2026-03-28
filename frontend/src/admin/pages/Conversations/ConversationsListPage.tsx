import { useEffect, useState } from "react";
import { listConversations } from "../../../services/admin.service";
import type { Conversation } from "../../../models/conversation.models";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR");
}

export default function ConversationsListPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listConversations();
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
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Conversations</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">Suivi et tracabilite des echanges utilisateur/chatbot.</p>
      </div>

      {loading && <div className="rounded-[28px] border border-white/80 bg-white/85 px-5 py-8 text-sm font-semibold text-slate-500 shadow-lg">Chargement des conversations...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {!loading && !error && conversations.length === 0 && <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center text-sm font-semibold text-slate-500">Aucune conversation enregistree.</div>}

      {!loading && !error && conversations.length > 0 && (
        <div className="grid gap-4">
          {conversations.map((item) => (
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-lg" key={item.id}>
              <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Question</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.question}</p>
              <div className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Reponse</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.answer}</p>
              <div className="mt-4 grid gap-1 text-sm font-medium text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
                <div>AskedAt: {formatDate(item.askedAt)}</div>
                <div>AnsweredAt: {formatDate(item.answeredAt)}</div>
                <div>CreatedAt: {formatDate(item.createdAt)}</div>
                <div>UserId: {item.userId ?? "-"}</div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
