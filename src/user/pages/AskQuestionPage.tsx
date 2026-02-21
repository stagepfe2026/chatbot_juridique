import { useState } from "react";
import { Link } from "react-router-dom";
import { askQuestion } from "../../services/user.service";
import type { AskQuestionResponse } from "../../models/chat.models";

export default function AskQuestionPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskQuestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAsk() {
    if (!question.trim()) {
      setError("Veuillez saisir une question.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await askQuestion({ question: question.trim() });
      setResult(res);
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message ?? "Erreur lors de la question.")
          : "Erreur lors de la question.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <div>
          <h1 className="page-title">Poser une question</h1>
          <p className="page-subtitle">Obtenir une réponse basée sur les documents indexés.</p>
        </div>
      </div>

      <section className="card">
        <label className="field-label">Question</label>
        <textarea
          className="textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: Quelles sont les conditions de déduction fiscale ?"
        />
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={onAsk} disabled={loading}>
            {loading ? "Recherche..." : "Envoyer"}
          </button>
        </div>
      </section>

      {error && <div className="message-error">{error}</div>}

      {result && (
        <section className="card">
          <h3 className="card-title">Réponse</h3>
          <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{result.answer}</p>
          <Link to={`/user/chat/sources/${result.questionId}`}>
            Consulter les sources ({result.sources.length})
          </Link>
        </section>
      )}
    </div>
  );
}
