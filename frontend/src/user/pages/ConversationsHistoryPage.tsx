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
    <div className="page">
      <div className="page-toolbar">
        <div>
          <h1 className="page-title">Mes conversations</h1>
          <p className="page-subtitle">Retrouvez vos anciens echanges avec l'assistant.</p>
        </div>
      </div>

      {loading && <div className="card">Chargement des conversations...</div>}
      {error && <div className="message-error">{error}</div>}

      {!loading && !error && conversations.length === 0 && (
        <div className="empty-state">Aucune conversation enregistree pour le moment.</div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <div className="field-grid">
          {conversations.map((item) => (
            <section className="card" key={item.id}>
              <h3 className="card-title" style={{ marginBottom: 6 }}>
                {item.title}
              </h3>
              <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{item.preview || item.summary || "-"}</p>
              <div style={{ color: "#5d6f90", fontSize: 13 }}>
                <div>Messages: {item.messageCount}</div>
                <div>Creee le: {formatDate(item.createdAt)}</div>
                <div>Maj le: {formatDate(item.updatedAt)}</div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
