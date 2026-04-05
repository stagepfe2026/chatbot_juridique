import { normalizeClaimStatus, type ClaimPriority, type ClaimSlaStatus, type ClaimStatus } from "../models/claim.models";

export function formatClaimDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelativeHours(hours: number) {
  if (!hours) return "Aucune reponse admin encore enregistree";
  return `${hours.toFixed(1)} h`;
}

export function statusBadgeClass(status: ClaimStatus) {
  const normalized = normalizeClaimStatus(status);
  if (normalized === "CLOSED") return "border-slate-300 bg-slate-100 text-slate-700";
  if (normalized === "RESOLVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "PROCESSING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "UNDER_REVIEW") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export function priorityBadgeClass(priority: ClaimPriority) {
  if (priority === "URGENT") return "border-rose-200 bg-rose-600 text-white";
  if (priority === "HIGH") return "border-amber-200 bg-amber-100 text-amber-800";
  if (priority === "NORMAL") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function slaBadgeClass(status: ClaimSlaStatus) {
  return status === "LATE"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function completionPercentage(subject: string, description: string, pageLink: string, attachment: boolean, priority: string) {
  let score = 35;
  if (subject.trim().length >= 8) score += 20;
  if (description.trim().length >= 40) score += 25;
  if (pageLink.trim()) score += 10;
  if (attachment) score += 5;
  if (priority) score += 5;
  return Math.min(score, 100);
}
