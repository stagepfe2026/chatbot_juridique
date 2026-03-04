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
    <div className="page">
      <div className="page-toolbar">
        <div>
          <h1 className="page-title">Conversations</h1>
          <p className="page-subtitle">Suivi et tracabilite des echanges utilisateur/chatbot.</p>
        </div>
      </div>

      {loading && <div className="card">Chargement des conversations...</div>}
      {error && <div className="message-error">{error}</div>}

      {!loading && !error && conversations.length === 0 && (
        <div className="empty-state">Aucune conversation enregistree.</div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <div className="field-grid">
          {conversations.map((item) => (
            <section className="card" key={item.id}>
              <h3 className="card-title" style={{ marginBottom: 6 }}>
                Question
              </h3>
              <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{item.question}</p>
              <h4 style={{ marginBottom: 6 }}>Reponse</h4>
              <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{item.answer}</p>
              <div style={{ color: "#5d6f90", fontSize: 13 }}>
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
