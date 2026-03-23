import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  createClaim,
  getMyClaimUnreadCount,
  listMyClaims,
  markMyClaimsRepliesAsRead,
} from "../../services/claims.service";
import type { Claim, ClaimAttachment, ClaimCategory } from "../../models/claim.models";
import { publishSnackbar } from "../../utils/snackbarBus";
import { buildWebSocketUrl } from "../../services/realtime.service";

const categories: Array<{ value: ClaimCategory; label: string }> = [
  { value: "ACCOUNT", label: "Compte" },
  { value: "CHATBOT", label: "Chatbot" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "OTHER", label: "Autre" },
];

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

type TabMode = "new" | "history";

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR");
}

function statusLabel(status: Claim["status"]): string {
  return status === "ANSWERED" ? "Repondu" : "En attente";
}

function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Format de fichier invalide."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

interface ClaimWidgetProps {
  refreshKey: string;
}

export default function ClaimWidget({ refreshKey }: ClaimWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>("new");
  const [category, setCategory] = useState<ClaimCategory>("CHATBOT");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function refreshUnreadCount() {
    try {
      const count = await getMyClaimUnreadCount();
      setUnreadCount(count);
    } catch {
      // ignore
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const data = await listMyClaims();
      setClaims(data);
    } catch {
      setClaims([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshKey]);

  useEffect(() => {
    const socket = new WebSocket(buildWebSocketUrl("/ws/claims"));

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; unreadCount?: number };
        if (payload.type === "CLAIM_REPLY") {
          setUnreadCount((prev) => {
            if (typeof payload.unreadCount === "number") return payload.unreadCount;
            return prev + 1;
          });
          publishSnackbar({ variant: "info", message: "Nouvelle reponse recue sur une reclamation." });
          if (isOpen && activeTab === "history") {
            void loadHistory();
          }
        }
      } catch {
        // ignore malformed websocket payload
      }
    };

    return () => {
      socket.close();
    };
  }, [activeTab, isOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  async function openModal() {
    const goHistory = unreadCount > 0;
    setActiveTab(goHistory ? "history" : "new");
    setIsOpen(true);

    if (goHistory) {
      await loadHistory();
      try {
        const count = await markMyClaimsRepliesAsRead();
        setUnreadCount(count);
      } catch {
        // ignore
      }
    }
  }

  function closeModal() {
    setIsOpen(false);
    setError(null);
  }

  function removeAttachment(fileName: string) {
    setAttachments((prev) => prev.filter((file) => file.name !== fileName));
  }

  function onChangeFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const nonImages = files.find((file) => !file.type.startsWith("image/"));
    if (nonImages) {
      setError("Seules les images sont autorisees (png, jpg, jpeg, webp).");
      return;
    }

    const oversized = files.find((file) => file.size > MAX_ATTACHMENT_SIZE);
    if (oversized) {
      setError("Chaque image doit etre inferieure a 5 MB.");
      return;
    }

    setAttachments((prev) => {
      const merged = [...prev, ...files];
      const uniqueByName = merged.filter(
        (file, index, array) => array.findIndex((item) => item.name === file.name) === index,
      );

      if (uniqueByName.length > MAX_ATTACHMENTS) {
        setError("Maximum 4 images par reclamation.");
        return uniqueByName.slice(0, MAX_ATTACHMENTS);
      }

      setError(null);
      return uniqueByName;
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (subject.trim().length < 3) {
      setError("Sujet trop court.");
      return;
    }

    if (description.trim().length < 10) {
      setError("Description insuffisante.");
      return;
    }

    try {
      setSubmitLoading(true);
      const preparedAttachments: ClaimAttachment[] = await Promise.all(
        attachments.map(async (file) => ({
          name: file.name,
          mimeType: file.type || "image/png",
          size: file.size,
          dataUrl: await dataUrlFromFile(file),
        })),
      );

      await createClaim({
        category,
        subject: subject.trim(),
        description: description.trim(),
        attachments: preparedAttachments,
      });

      setSubject("");
      setDescription("");
      setAttachments([]);
      publishSnackbar({ variant: "success", message: "Reclamation envoyee." });
      setActiveTab("history");
      await loadHistory();
      setIsOpen(true);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: unknown }).message ?? "Erreur lors de l'envoi.")
          : "Erreur lors de l'envoi.";
      setError(message);
    } finally {
      setSubmitLoading(false);
    }
  }

  const isSubmitDisabled =
    submitLoading || subject.trim().length < 3 || description.trim().length < 10;

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_14px_30px_rgba(220,38,38,0.4)] transition hover:scale-[1.04] hover:bg-red-700"
        aria-label="Ouvrir les reclamations"
        onClick={() => {
          void openModal();
        }}
      >
        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v7.4A2.8 2.8 0 0 1 17.2 16H9l-5 4V5.8z" />
          <path d="M12 8h.01" />
          <path d="M12 11.5v2.8" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] bg-slate-100 shadow-[0_40px_100px_rgba(15,23,42,0.4)]">
            <div className="relative grid gap-3 bg-gradient-to-r from-red-600 to-red-500 px-6 pb-8 pt-6 text-white">
              <div>
                <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">Support</div>
                <h2 className="mt-3 text-3xl font-black leading-tight">Reclamations</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium text-red-50">Envoyez une reclamation et suivez les reponses de l'equipe.</p>

                <div className="mt-4 inline-flex rounded-full bg-white/20 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("new")}
                    className={`rounded-full px-3 py-1.5 transition ${
                      activeTab === "new" ? "bg-white text-red-600" : "bg-white/30 text-white ring-1 ring-white/45 hover:bg-white/40"
                    }`}
                  >
                    Nouvelle reclamation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("history");
                      void loadHistory();
                    }}
                    className={`rounded-full px-3 py-1.5 transition ${
                      activeTab === "history" ? "bg-white text-red-600" : "bg-white/30 text-white ring-1 ring-white/45 hover:bg-white/40"
                    }`}
                  >
                    Mes reclamations
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
              <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.08)] lg:p-5">
                {activeTab === "new" ? (
                  <form onSubmit={onSubmit} className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Categorie *</span>
                        <select
                          value={category}
                          onChange={(event) => setCategory(event.target.value as ClaimCategory)}
                          className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        >
                          {categories.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sujet *</span>
                        <input
                          value={subject}
                          onChange={(event) => setSubject(event.target.value)}
                          placeholder="Resume du probleme"
                          className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        />
                      </label>
                    </div>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Description detaillee *</span>
                      <textarea
                        rows={6}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Decrivez le probleme de maniere detaillee..."
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Captures d'ecran (optionnel)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={onChangeFiles}
                        className="rounded-xl border border-dashed border-slate-400 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                      />
                      {attachments.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {attachments.map((file) => (
                            <div key={file.name} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              <span className="truncate pr-2">{file.name}</span>
                              <button
                                type="button"
                                className="rounded-md bg-slate-200 px-2 py-1 font-semibold text-slate-800 hover:bg-slate-300"
                                onClick={() => removeAttachment(file.name)}
                              >
                                Retirer
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </label>

                    {error && (
                      <div className="rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">{error}</div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:bg-slate-500 disabled:text-slate-100 disabled:opacity-100 disabled:cursor-not-allowed"
                      >
                        {submitLoading ? "Envoi..." : "Envoyer"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid gap-3">
                    {historyLoading && (
                      <div className="rounded-xl border border-slate-300 bg-slate-100 px-3 py-6 text-sm font-semibold text-slate-700">
                        Chargement des reclamations...
                      </div>
                    )}

                    {!historyLoading && claims.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-400 bg-slate-100 px-3 py-8 text-center text-sm font-semibold text-slate-700">
                        Aucune reclamation pour le moment.
                      </div>
                    )}

                    {!historyLoading && claims.map((claim) => (
                      <article key={claim.id} className="rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_10px_20px_rgba(15,23,42,0.08)]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-black text-slate-900">{claim.subject}</h3>
                            <div className="text-xs font-medium text-slate-500">{formatDate(claim.createdAt)}</div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                              claim.status === "ANSWERED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {statusLabel(claim.status)}
                          </span>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{claim.description}</p>

                        {claim.attachments.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {claim.attachments.map((file, index) => (
                              <a
                                key={`${claim.id}-image-${index}`}
                                href={file.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group overflow-hidden rounded-lg border border-slate-200"
                              >
                                <img src={file.dataUrl} alt={file.name} className="h-24 w-full object-cover transition group-hover:scale-105" />
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2">
                          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Reponse admin</div>
                          {claim.adminReply ? (
                            <>
                              <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-700">{claim.adminReply}</p>
                              <div className="mt-1 text-[11px] text-slate-600">{formatDate(claim.adminReplyAt)} - {claim.adminReplyBy ?? "Admin"}</div>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-slate-500">Aucune reponse pour le moment.</p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


