import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { type Claim, type ClaimActivityLogEntry } from "../../models/claim.models";
import { getMyClaim } from "../../services/claims.service";
import { formatClaimDate, priorityBadgeClass, statusBadgeClass } from "../../claims/claimUi";
import { useI18n } from "../../i18n/I18nContext";

const labels = {
  fr: { back: "Retour aux reclamations", folder: "Dossier reclamation", view: "Voir dossier", loading: "Chargement du dossier...", ticket: "Numero de ticket", category: "Categorie", createdAt: "Date de creation", updatedAt: "Derniere mise a jour", description: "Description de la reclamation", attachments: "Pieces jointes et liens", openPage: "Ouvrir la page concernee", noLink: "Aucun lien associe.", noAttachment: "Aucune piece jointe.", reply: "Reponse et suivi", noReply: "Aucune reponse administrative pour le moment.", replySent: "Reponse envoyee le", status: "Statut", history: "Historique", claimCreated: "Reclamation creee", replyTransmitted: "Reponse administrative transmise", processing: "Dossier en cours de traitement", user: "Utilisateur", admin: "Administration" },
  en: { back: "Back to claims", folder: "Claim file", view: "View file", loading: "Loading file...", ticket: "Ticket number", category: "Category", createdAt: "Creation date", updatedAt: "Last update", description: "Claim description", attachments: "Attachments and links", openPage: "Open related page", noLink: "No linked page.", noAttachment: "No attachment.", reply: "Reply and follow-up", noReply: "No administrative reply yet.", replySent: "Reply sent on", status: "Status", history: "History", claimCreated: "Claim created", replyTransmitted: "Administrative reply sent", processing: "File is being processed", user: "User", admin: "Administration" },
  ar: { back: "العودة إلى الشكايات", folder: "ملف الشكاية", view: "عرض الملف", loading: "جاري تحميل الملف...", ticket: "رقم التذكرة", category: "الفئة", createdAt: "تاريخ الإنشاء", updatedAt: "آخر تحديث", description: "وصف الشكاية", attachments: "المرفقات والروابط", openPage: "فتح الصفحة المعنية", noLink: "لا يوجد رابط مرتبط.", noAttachment: "لا توجد مرفقات.", reply: "الرد والمتابعة", noReply: "لا يوجد رد إداري حالياً.", replySent: "تم إرسال الرد في", status: "الحالة", history: "السجل", claimCreated: "تم إنشاء الشكاية", replyTransmitted: "تم إرسال الرد الإداري", processing: "الملف قيد المعالجة", user: "المستخدم", admin: "الإدارة" },
} as const;

export default function ClaimDetailPage() {
  const { claimStatusLabel, claimPriorityLabel, claimCategoryLabel, language } = useI18n();
  const l = labels[language];
  const { claimId = "" } = useParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadClaim() {
      try { setLoading(true); const data = await getMyClaim(claimId); if (!cancelled) setClaim(data); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadClaim();
    return () => { cancelled = true; };
  }, [claimId]);

  const ticketNumber = useMemo(() => {
    if (!claim) return "-";
    if (claim.ticketNumber?.trim()) return claim.ticketNumber;
    const year = new Date(claim.createdAt).getFullYear();
    const serial = String(([...(claim.id + claim.createdAt)].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 10000).padStart(4, "0");
    return `REC-${year}-${serial}`;
  }, [claim]);

  const history = useMemo<ClaimActivityLogEntry[]>(() => {
    if (!claim) return [];
    if (claim.activityLog?.length) return claim.activityLog;
    const items: ClaimActivityLogEntry[] = [{ id: `${claim.id}-created`, description: l.claimCreated, actorName: l.user, createdAt: claim.createdAt }];
    if (claim.status !== "SUBMITTED") items.push({ id: `${claim.id}-updated`, description: claim.adminReply ? l.replyTransmitted : l.processing, actorName: claim.adminReplyBy || l.admin, createdAt: claim.adminReplyAt || claim.updatedAt });
    return items;
  }, [claim, l]);

  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 space-y-5 px-4">
      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-lg"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><Link to="/user/reclamations" className="text-[12px] font-semibold text-slate-600 no-underline hover:text-slate-900">{l.back}</Link><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{l.folder}</p><h1 className="mt-1 text-xl font-semibold text-slate-950">{claim?.subject || l.view}</h1></div>{claim ? <div className="flex flex-wrap gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusBadgeClass(claim.status)}`}>{claimStatusLabel(claim.status)}</span><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${priorityBadgeClass(claim.priority ?? "NORMAL")}`}>{claimPriorityLabel(claim.priority ?? "NORMAL")}</span></div> : null}</div></section>
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white px-5 py-6 text-[13px] text-slate-500 shadow-lg">{l.loading}</div> : null}
      {claim ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><section className="grid gap-4"><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><InfoCard label={l.ticket} value={ticketNumber} /><InfoCard label={l.category} value={claimCategoryLabel(claim.category)} /><InfoCard label={l.createdAt} value={formatClaimDate(claim.createdAt)} /><InfoCard label={l.updatedAt} value={formatClaimDate(claim.updatedAt)} /></div></section><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg"><div className="text-[14px] font-semibold text-slate-900">{l.description}</div><p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-slate-600">{claim.description}</p></section><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg"><div className="text-[14px] font-semibold text-slate-900">{l.attachments}</div><div className="mt-3 grid gap-2 text-[13px] text-slate-600">{claim.pageContext ? <a href={claim.pageContext} className="font-semibold text-slate-800 no-underline hover:text-slate-950">{l.openPage}</a> : <div>{l.noLink}</div>}{claim.attachments?.length ? claim.attachments.map((file, index) => <div key={`${file.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><div className="font-semibold text-slate-800">{file.name}</div><div className="text-[11px] text-slate-500">{Math.round(file.size / 1024)} KB</div></div>) : <div>{l.noAttachment}</div>}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg"><div className="text-[14px] font-semibold text-slate-900">{l.reply}</div><div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-600">{claim.adminReply || l.noReply}</div>{claim.adminReplyAt ? <div className="mt-2 text-[11px] text-slate-500">{l.replySent} {formatClaimDate(claim.adminReplyAt)}</div> : null}</section></section><aside className="grid gap-4"><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{l.status}</div><div className="mt-3 grid gap-2"><WorkflowRow label={claimStatusLabel("SUBMITTED")} active={true} /><WorkflowRow label={claimStatusLabel("UNDER_REVIEW")} active={claim.status !== "SUBMITTED"} /><WorkflowRow label={claimStatusLabel("PROCESSING")} active={["PROCESSING", "RESOLVED", "CLOSED", "ANSWERED"].includes(claim.status)} /><WorkflowRow label={claimStatusLabel("RESOLVED")} active={["RESOLVED", "CLOSED", "ANSWERED"].includes(claim.status)} /><WorkflowRow label={claimStatusLabel("CLOSED")} active={claim.status === "CLOSED"} /></div></section><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{l.history}</div><div className="mt-3 grid gap-3">{history.map((entry) => <div key={entry.id} className="relative pl-4 text-[12px] text-slate-600 before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-slate-500"><div className="font-semibold text-slate-800">{entry.description}</div><div>{entry.actorName} | {formatClaimDate(entry.createdAt)}</div></div>)}</div></section></aside></div> : null}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div><div className="mt-1 text-[13px] font-semibold text-slate-900">{value}</div></div>; }
function WorkflowRow({ label, active }: { label: string; active: boolean }) { return <div className={`rounded-2xl border px-3 py-2.5 text-[13px] ${active ? "border-slate-300 bg-slate-50 text-slate-900" : "border-slate-200 bg-white text-slate-400"}`}><div className="font-semibold">{label}</div></div>; }
