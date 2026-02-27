import { useState } from "react";
import { askQuestion } from "../../services/user.service";
import type { AskQuestionResponse } from "../../models/chat.models";

export default function AskQuestionPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskQuestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionTime, setQuestionTime] = useState<string | null>(null);
  const [answerTime, setAnswerTime] = useState<string | null>(null);

  function nowAsTime() {
    return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const [greetingTime] = useState<string>(nowAsTime());

  async function onAsk() {
    if (!question.trim()) {
      setError("Veuillez saisir une question.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setQuestionTime(nowAsTime());
      const res = await askQuestion({ question: question.trim() });
      setResult(res);
      setAnswerTime(nowAsTime());
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
    <div className="chat-page">
      <section className="chat-thread">
        <article className="chat-row assistant">
          <div className="chat-bubble assistant">
            <p style={{ margin: 0 }}>Bonjour! Je suis votre assistant. Comment puis-je vous aider aujourd'hui?</p>
            <div className="chat-time">{greetingTime}</div>
          </div>
        </article>

        {question.trim() && (
          <article className="chat-row user">
            <div className="chat-bubble user">
              <p style={{ margin: 0 }}>{question}</p>
              {questionTime && <div className="chat-time">{questionTime}</div>}
            </div>
          </article>
        )}

        {loading && (
          <article className="chat-row assistant">
            <div className="chat-bubble assistant">
              <span className="chat-spinner" aria-hidden="true" />
              Generation de la reponse...
            </div>
          </article>
        )}

        {!loading && result && (
          <article className="chat-row assistant">
            <div className="chat-bubble assistant large">
              <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{result.answer}</p>
              {result.sourceFile && (
                <a className="chat-file-card" href={result.sourceFile.downloadUrl} download={result.sourceFile.filename}>
                  <span className="chat-file-icon">↧</span>
                  <span className="chat-file-name">{result.sourceFile.filename}</span>
                </a>
              )}
              {answerTime && <div className="chat-time">{answerTime}</div>}
            </div>
          </article>
        )}
      </section>

      <section className="chat-composer">
        <textarea
          className="chat-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Tapez votre message..."
        />
        <div className="chat-actions">
          <button className="chat-send-btn" type="button" onClick={onAsk} disabled={loading}>
            {loading ? "Recherche..." : "Envoyer"}
          </button>
        </div>
      </section>
      {error && <div className="message-error">{error}</div>}
    </div>
  );
}
