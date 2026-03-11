import { Link } from "react-router-dom";
import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function UserHomePage() {
  return (
    <div className="user-home">
      <section className="user-home-hero">
        <div className="user-home-hero-card">
          <span className="user-home-badge">Assistant Juridique</span>
          <h1>Bienvenue dans votre espace documentaire</h1>
          <p>Accedez au chatbot RAG ou lancez une recherche rapide dans vos documents.</p>
          <div className="user-home-actions">
            <Link className="btn btn-primary" to="/user/chat">
              Ouvrir le chatbot
            </Link>
            <Link className="btn btn-ghost" to="/user/recherche">
              Rechercher un document
            </Link>
            <Link className="btn btn-ghost" to="/user/favoris">
              Voir mes favoris
            </Link>
          </div>
        </div>
        <div className="user-home-hero-panel">
          <div className="user-home-stat">
            <div className="user-home-stat-icon">
              <Icon>
                <path d="M4 6h16v12H4z" />
                <path d="M8 10h8" />
              </Icon>
            </div>
            <div>
              <div className="user-home-stat-title">Recherche intelligente</div>
              <div className="user-home-stat-text">Trouvez un document par titre ou contenu.</div>
            </div>
          </div>
          <div className="user-home-stat">
            <div className="user-home-stat-icon">
              <Icon>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </Icon>
            </div>
            <div>
              <div className="user-home-stat-title">Consultations guidees</div>
              <div className="user-home-stat-text">Posez vos questions juridiques en direct.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="user-home-links">
        <Link className="user-home-link-card" to="/user/chat">
          <div className="user-home-link-icon">
            <Icon>
              <path d="M8 3h6l4 4v14H6V3z" />
              <path d="M14 3v4h4" />
            </Icon>
          </div>
          <div>
            <div className="user-home-link-title">Chatbot juridique</div>
            <div className="user-home-link-text">Interrogez vos documents avec l'IA.</div>
          </div>
        </Link>
        <Link className="user-home-link-card" to="/user/recherche">
          <div className="user-home-link-icon">
            <Icon>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4.2-4.2" />
            </Icon>
          </div>
          <div>
            <div className="user-home-link-title">Recherche documentaire</div>
            <div className="user-home-link-text">Filtrez, explorez et favorisez vos sources.</div>
          </div>
        </Link>
        <Link className="user-home-link-card" to="/user/favoris">
          <div className="user-home-link-icon">
            <Icon>
              <path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" />
            </Icon>
          </div>
          <div>
            <div className="user-home-link-title">Documents favoris</div>
            <div className="user-home-link-text">Accedez aux documents que vous avez favorises.</div>
          </div>
        </Link>
      </section>
    </div>
  );
}
