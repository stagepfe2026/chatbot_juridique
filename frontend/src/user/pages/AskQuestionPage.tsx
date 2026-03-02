import { useState } from "react";
import { askQuestion } from "../../services/user.service";
import type { SourceFile } from "../../models/chat.models";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  sourceFile?: SourceFile | null;
};

export default function AskQuestionPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function nowAsTime() {
    return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  const [greetingTime] = useState<string>(nowAsTime());

  async function onAsk() {
    const currentQuestion = question.trim();
    if (!currentQuestion) {
      setError("Veuillez saisir une question.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: currentQuestion,
        time: nowAsTime(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setQuestion("");

      const res = await askQuestion({ question: currentQuestion });
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.answer,
        time: nowAsTime(),
        sourceFile: res.sourceFile ?? null,
      };
      setMessages((prev) => [...prev, assistantMessage]);
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

        {messages.map((message) => (
          <article key={message.id} className={`chat-row ${message.role}`}>
            <div className={`chat-bubble ${message.role}${message.role === "assistant" ? " large" : ""}`}>
              <p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{message.text}</p>
              {message.sourceFile && (
                <a className="chat-file-card" href={message.sourceFile.downloadUrl} download={message.sourceFile.filename}>
                  <span className="chat-file-icon">v</span>
                  <span className="chat-file-name">{message.sourceFile.filename}</span>
                </a>
              )}
              <div className="chat-time">{message.time}</div>
            </div>
          </article>
        ))}

        {loading && (
          <article className="chat-row assistant">
            <div className="chat-bubble assistant">
              <span className="chat-spinner" aria-hidden="true" />
              Generation de la reponse...
            </div>
          </article>
        )}
      </section>

      <section className="chat-composer">
        <textarea
          className="chat-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!loading) onAsk();
            }
          }}
          placeholder="Posez votre question juridique..."
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
