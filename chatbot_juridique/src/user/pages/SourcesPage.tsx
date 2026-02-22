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
    <div className="page">
      <div className="page-toolbar">
        <div>
          <h1 className="page-title">Sources</h1>
          <p className="page-subtitle">Justificatifs utilisés pour générer la réponse.</p>
        </div>
        <Link to="/user/chat" style={{ textDecoration: "none" }}>
          <button className="btn btn-ghost" type="button">
            Retour au chat
          </button>
        </Link>
      </div>

      {loading && <div className="card">Chargement des sources...</div>}
      {error && <div className="message-error">{error}</div>}

      {!loading && !error && sources.length === 0 && <div className="empty-state">Aucune source trouvée.</div>}

      {!loading && !error && sources.length > 0 && (
        <div className="field-grid">
          {sources.map((source) => (
            <section className="card" key={`${source.documentId}-${source.excerpt.slice(0, 20)}`}>
              <h3 className="card-title">{source.title}</h3>
              <div style={{ marginBottom: 8, color: "#5d6f90" }}>Document #{source.documentId}</div>
              <p style={{ margin: 0 }}>{source.excerpt}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
