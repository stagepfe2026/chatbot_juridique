import { useCallback, useEffect, useMemo, useState } from "react";
import { listAdminClaims, replyToClaim } from "../../../services/claims.service";
import type { Claim, ClaimCategory, ClaimPriority, ClaimStatus } from "../../../models/claim.models";
import { publishSnackbar } from "../../../utils/snackbarBus";
import { buildWebSocketUrl } from "../../../services/realtime.service";

const categoryMap: Record<ClaimCategory, string> = {
  ACCOUNT: "Compte",
  CHATBOT: "Chatbot",
  DOCUMENT: "Documents",
  OTHER: "Autre",
};

const priorityMap: Record<ClaimPriority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

function statusLabel(value: ClaimStatus): string {
  return value === "ANSWERED" ? "Traitée" : "En attente";
}

function summarizeDescription(description: string): string {
  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) return "Aucun résumé disponible";

  const cleaned = normalized
    .replace(/^(bonjour|salut|bonsoir)[,\s-]*/i, "")
    .replace(/(merci d'avance|merci|cordialement|svp)\.?$/i, "")
    .trim();

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const keywords = [
    "erreur",
    "probleme",
    "bug",
    "impossible",
    "bloque",
    "bloquee",
    "ouverture",
    "connexion",
    "document",
    "chat",
    "telechargement",
    "recherche",
    "page",
  ];

  const bestSentence = (sentences.length > 0 ? sentences : [cleaned])
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const keywordScore = keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 3 : 0), 0);
      const lengthScore = Math.min(sentence.length, 90) / 30;
      return { sentence, score: keywordScore + lengthScore };
    })
    .sort((a, b) => b.score - a.score)[0]?.sentence ?? cleaned;

  let summary = bestSentence
    .replace(/^(j'ai|je rencontre|je constate|je veux signaler|nous avons|on a)\s+/i, "")
    .replace(/^(un|une|des)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();

  if (!summary) summary = cleaned;
  if (summary.length > 72) summary = `${summary.slice(0, 69).trimEnd()}...`;

  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

function getInitials(email: string): string {
  const base = email.split("@")[0] || "U";
  const parts = base.split(/[.\-_ ]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#ece4e1] bg-[#fcfaf9] px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#a0928c]">{label}</div>
      <div className="mt-1 break-words text-xs font-medium text-[#1f1b1a]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ClaimStatus }) {
  const answered = status === "ANSWERED";
  return (
    <span
      className={
        answered
          ? "inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white"
          : "inline-flex rounded-full bg-[#233142] px-2 py-0.5 text-[10px] font-semibold text-white"
      }
    >
      {statusLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ClaimPriority }) {
  const tone =
    priority === "URGENT"
      ? "bg-red-500 text-white"
      : priority === "HIGH"
        ? "bg-orange-500 text-white"
        : priority === "NORMAL"
          ? "bg-gray-400 text-white"
          : "bg-slate-200 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
      {priorityMap[priority]}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#ece4e1] bg-white p-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a0928c]">{title}</div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatCard({
  title,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-[#e9e1de] bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#7d706b]">{title}</p>
            <p className="text-[26px] font-bold leading-none tracking-tight text-[#140a08]">{value}</p>
          </div>

          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClaimsManagementPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminClaims();
      setClaims(
        data.map((claim) => ({
          ...claim,
          priority: claim.priority ?? "NORMAL",
          pageContext: claim.pageContext ?? "",
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  useEffect(() => {
    const socket = new WebSocket(buildWebSocketUrl("/ws/claims"));
    socket.onmessage = () => void loadClaims();
    return () => socket.close();
  }, [loadClaims]);

  const selectedClaim = useMemo(
    () => claims.find((claim) => claim.id === selectedId) ?? null,
    [claims, selectedId]
  );

  const stats = useMemo(() => {
    const pending = claims.filter((c) => c.status !== "ANSWERED").length;
    const answered = claims.filter((c) => c.status === "ANSWERED").length;
    const urgent = claims.filter((c) => (c.priority ?? "NORMAL") === "URGENT").length;
    const high = claims.filter((c) => {
      const p = c.priority ?? "NORMAL";
      return p === "HIGH" || p === "URGENT";
    }).length;

    return {
      pending,
      answered,
      urgent,
      high,
    };
  }, [claims]);

  async function onReply(claimId: string) {
    const message = (replyDrafts[claimId] ?? "").trim();
    if (message.length < 3) {
      return publishSnackbar({ variant: "warning", message: "Réponse trop courte" });
    }

    setSavingId(claimId);
    try {
      await replyToClaim(claimId, { message });
      setReplyDrafts((prev) => ({ ...prev, [claimId]: "" }));
      setSelectedId(null);
      setPreviewImage(null);
      await loadClaims();
      publishSnackbar({ variant: "success", message: "Réponse envoyée" });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#1f1b1a]">
          Gestion des réclamations
        </h1>
      
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Réclamations en attente"
          value={String(stats.pending)}
          iconBg="bg-[#fff1ed]"
          iconColor="text-[#DA3D20]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          }
        />

        <StatCard
          title="Réclamations traitées"
          value={String(stats.answered)}
          iconBg="bg-blue-50"
          iconColor="text-[#233142]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m20 6-11 11-5-5" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          }
        />

        <StatCard
          title="Réclamations urgentes"
          value={String(stats.urgent)}
          iconBg="bg-gray-200"
        iconColor="text-gray-600"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          }
        />

        <StatCard
          title="Priorité élevée"
          value={String(stats.high)}
          iconBg="bg-[#e9f8ef]"
          iconColor="text-[#16a34a]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.6fr]">
        <div className="rounded-[22px] border border-[#e9e1de] bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#140a08]">Réclamations récentes</h2>
         
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8b7d78]">
                  <th className="border-b border-[#eee6e3] px-3 py-2.5">Utilisateur</th>
                  <th className="border-b border-[#eee6e3] px-3 py-2.5">Sujet</th>
                  <th className="border-b border-[#eee6e3] px-3 py-2.5">Priorité</th>
                  <th className="border-b border-[#eee6e3] px-3 py-2.5">Statut</th>
                  <th className="border-b border-[#eee6e3] px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-[#8b7d78]">
                      Chargement...
                    </td>
                  </tr>
                ) : null}

                {!loading && claims.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-[#8b7d78]">
                      Aucune réclamation
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                  claims.map((claim) => (
                    <tr key={claim.id} className="align-middle">
                      <td className="border-b border-[#f3ece9] px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5ece8] text-[10px] font-bold text-[#1f1b1a]">
                            {getInitials(claim.userEmail)}
                          </div>
                          <span className="text-xs font-semibold text-[#1f1b1a]">{claim.userEmail}</span>
                        </div>
                      </td>

                      <td className="border-b border-[#f3ece9] px-3 py-3">
                        <div className="max-w-[290px]">
                          <div className="text-xs font-semibold leading-5 text-[#1f1b1a]">
                            {summarizeDescription(claim.description)}
                          </div>
                          <div className="mt-1 text-[11px] text-[#8b7d78]">{claim.subject}</div>
                        </div>
                      </td>


                      <td className="border-b border-[#f3ece9] px-3 py-3">
                        <PriorityBadge priority={claim.priority ?? "NORMAL"} />
                      </td>

                      <td className="border-b border-[#f3ece9] px-3 py-3">
                        <StatusBadge status={claim.status} />
                      </td>

                      <td className="border-b border-[#f3ece9] px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(claim.id)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-[#e8dfdc] bg-white px-3 text-[11px] font-semibold text-[#5f5551] transition hover:border-[#DA3D20] hover:bg-[#fff5f1] hover:text-[#DA3D20]"
                        >
                          Consulter
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-[#e9e1de] bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-[#140a08]">Réclamations critiques</h3>
            <p className="mt-1 text-xs text-[#7d706b]">
              Réclamations urgentes.
            </p>

            <div className="mt-4 space-y-3">
              {claims
                .filter((claim) => (claim.priority ?? "NORMAL") === "URGENT" || (claim.priority ?? "NORMAL") === "HIGH")
                .slice(0, 4)
                .map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-xl border border-[#f3d9d4] bg-[#fff8f6] px-3 py-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5ece8] text-[10px] font-bold text-[#1f1b1a]">
                        {getInitials(claim.userEmail)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#1f1b1a]">{claim.userEmail}</div>
                        <div className="mt-0.5 text-xs font-semibold leading-5 text-[#d94841]">
                          {summarizeDescription(claim.description)}
                        </div>
                        <div className="mt-1 text-[11px] text-[#7d706b]">
                          {new Date(claim.createdAt).toLocaleString("fr-FR")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              {!loading &&
              claims.filter((claim) => (claim.priority ?? "NORMAL") === "URGENT" || (claim.priority ?? "NORMAL") === "HIGH").length === 0 ? (
                <div className="rounded-xl border border-[#ece4e1] bg-[#fcfaf9] px-4 py-6 text-center text-xs text-[#8b7d78]">
                  Aucun dossier critique.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {selectedClaim ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] border border-[#ece4e1] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#ece4e1] bg-[#fcfaf9] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a0928c]">
                  Dossier réclamation
                </div>
                <h2 className="mt-1.5 truncate text-lg font-bold tracking-tight text-[#1f1b1a]">
                  {selectedClaim.subject}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e8dfdc] bg-white px-3 text-xs font-medium text-[#5f5551] transition hover:bg-[#fff5f1] hover:text-[#DA3D20]"
              >
                Fermer
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoBox label="Utilisateur" value={selectedClaim.userEmail} />
                <InfoBox label="Date" value={new Date(selectedClaim.createdAt).toLocaleString("fr-FR")} />
                <InfoBox label="Priorité" value={priorityMap[selectedClaim.priority ?? "NORMAL"]} />
              </div>

              <div className="mt-4 grid gap-4">
                <SectionCard title="Description">
                  <p className="whitespace-pre-wrap text-xs leading-6 text-[#5f5551]">
                    {selectedClaim.description}
                  </p>
                  {selectedClaim.pageContext ? (
                    <div className="mt-3 rounded-xl bg-[#fcfaf9] px-3 py-2.5 text-xs text-[#7d706b]">
                      Page/Lien: {selectedClaim.pageContext}
                    </div>
                  ) : null}
                </SectionCard>

                {selectedClaim.attachments.length > 0 ? (
                  <SectionCard title="Captures d'écran">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {selectedClaim.attachments.map((file, index) => (
                        <button
                          key={selectedClaim.id + "-img-" + index}
                          type="button"
                          onClick={() => setPreviewImage({ src: file.dataUrl, alt: `Capture ${index + 1}` })}
                          className="overflow-hidden rounded-xl border border-[#ece4e1] bg-[#fcfaf9] transition hover:border-[#DA3D20]"
                        >
                          <img src={file.dataUrl} alt={`Capture ${index + 1}`} className="h-28 w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </SectionCard>
                ) : null}

                <SectionCard title="Réponse à l'utilisateur">
                  <textarea
                    rows={5}
                    value={replyDrafts[selectedClaim.id] ?? ""}
                    onChange={(event) =>
                      setReplyDrafts((prev) => ({
                        ...prev,
                        [selectedClaim.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#e8dfdc] px-3 py-2.5 text-xs text-[#1f1b1a] outline-none transition focus:border-[#DA3D20] focus:ring-2 focus:ring-[#ffe6de]"
                    placeholder="Écrire votre réponse..."
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void onReply(selectedClaim.id)}
                      disabled={savingId === selectedClaim.id}
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-[#DA3D20] px-4 text-xs font-semibold text-white transition hover:bg-[#C73519] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingId === selectedClaim.id ? "Envoi..." : "Envoyer"}
                    </button>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[90vh] w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
            >
              Fermer
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[90vh] w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
