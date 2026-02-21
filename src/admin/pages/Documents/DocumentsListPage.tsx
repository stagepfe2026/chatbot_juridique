import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDocuments } from "../../../services/admin.service";
import type { Document, DocumentCategory, DocumentStatus } from "../../../models/document.models";

const categoryLabel: Record<DocumentCategory, string> = {
  LOI_DES_FINANCES: "Loi des finances",
  RECUEILS_DES_TEXTES_FISCAUX: "Recueils des textes fiscaux",
  NOTE_COMMUNES: "Notes communes",
  CONVENTIONS_DE_NON_DOUBLE_IMPOSITION: "Conventions de non double imposition",
};

const statusLabel: Record<DocumentStatus, string> = {
  INDEXED: "Indexé",
  FAILED: "Échec",
};

export default function DocumentsListPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listDocuments();
        setDocuments(data);
      } catch (e: unknown) {
        const message =
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "Erreur de chargement.")
            : "Erreur de chargement.";
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
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">Liste des documents juridiques importés.</p>
        </div>
        <Link to="/admin/documents/import" style={{ textDecoration: "none" }}>
          <button type="button" className="btn btn-primary">
            Importer un document
          </button>
        </Link>
      </div>

      {loading && <div className="card">Chargement des documents...</div>}
      {error && <div className="message-error">{error}</div>}

      {!loading && !error && (!Array.isArray(documents) || documents.length === 0) && (
        <div className="empty-state">Aucun document à afficher pour le moment.</div>
      )}

      {!loading && !error && Array.isArray(documents) && documents.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #e7ecf5" }}>Titre</th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #e7ecf5" }}>
                  Catégorie
                </th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #e7ecf5" }}>Statut</th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #e7ecf5" }}>Créé le</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f3f9" }}>{doc.title}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f3f9" }}>{categoryLabel[doc.category]}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f3f9" }}>
                    {statusLabel[doc.documentStatus]}
                  </td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f3f9" }}>
                    {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
