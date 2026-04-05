import { httpClient } from "./httpClient";
import { normalizeClaimStatus, type Claim, type ClaimCategory, type ClaimCreateRequest, type ClaimPriority, type ClaimReplyRequest, type ClaimStats, type ClaimStatus, type ClaimUnreadCount } from "../models/claim.models";

export interface ListMyClaimsFilters {
  status?: ClaimStatus | "";
  search?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface ListAdminClaimsFilters extends ListMyClaimsFilters {
  category?: ClaimCategory | "";
  priority?: ClaimPriority | "";
}

export interface UpdateAdminClaimStatusRequest {
  status: ClaimStatus;
}

export interface AssignAdminClaimRequest {
  name: string;
  email: string;
}

function filterClaims(rows: Claim[], filters?: ListAdminClaimsFilters): Claim[] {
  if (!filters) return rows;

  const query = filters.search?.trim().toLocaleLowerCase("fr-FR") ?? "";
  const fromDate = filters.createdFrom ? new Date(`${filters.createdFrom}T00:00:00`).getTime() : null;
  const toDate = filters.createdTo ? new Date(`${filters.createdTo}T23:59:59`).getTime() : null;

  return rows.filter((claim) => {
    if (filters.status && normalizeClaimStatus(claim.status) !== normalizeClaimStatus(filters.status)) return false;
    if (filters.category && claim.category !== filters.category) return false;
    if (filters.priority && (claim.priority ?? "NORMAL") !== filters.priority) return false;

    if (query) {
      const haystack = [claim.subject, claim.description, claim.adminReply, claim.pageContext, claim.userEmail, claim.ticketNumber]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr-FR");
      if (!haystack.includes(query)) return false;
    }

    const createdAt = new Date(claim.createdAt).getTime();
    if (fromDate !== null && createdAt < fromDate) return false;
    if (toDate !== null && createdAt > toDate) return false;
    return true;
  });
}

export async function createClaim(payload: ClaimCreateRequest): Promise<Claim> {
  const res = await httpClient.post<Claim>("/claims", payload);
  return res.data;
}

export async function listMyClaims(filters?: ListMyClaimsFilters): Promise<Claim[]> {
  const res = await httpClient.get<Claim[]>("/claims/me");
  const rows = Array.isArray(res.data) ? res.data : [];
  return filterClaims(rows, filters);
}

export async function getMyClaim(claimId: string): Promise<Claim> {
  const res = await httpClient.get<Claim>(`/claims/me/${claimId}`);
  return res.data;
}

export async function getMyClaimUnreadCount(): Promise<number> {
  const res = await httpClient.get<ClaimUnreadCount>("/claims/me/unread-count");
  return Number(res.data?.count ?? 0);
}

export async function markMyClaimsRepliesAsRead(): Promise<number> {
  const res = await httpClient.post<ClaimUnreadCount>("/claims/me/mark-read");
  return Number(res.data?.count ?? 0);
}

export async function listAdminClaims(filters?: ListAdminClaimsFilters): Promise<Claim[]> {
  const res = await httpClient.get<Claim[]>("/admin/claims");
  const rows = Array.isArray(res.data) ? res.data : [];
  return filterClaims(rows, filters);
}

export async function getAdminClaim(claimId: string): Promise<Claim> {
  const rows = await listAdminClaims();
  const claim = rows.find((entry) => entry.id === claimId);
  if (!claim) throw new Error("Reclamation introuvable.");
  return claim;
}

export async function replyToClaim(claimId: string, payload: ClaimReplyRequest): Promise<Claim> {
  const res = await httpClient.post<Claim>(`/admin/claims/${claimId}/reply`, payload);
  return res.data;
}

export async function replyToAdminClaim(claimId: string, payload: ClaimReplyRequest): Promise<Claim> {
  return replyToClaim(claimId, payload);
}

export async function updateAdminClaimStatus(claimId: string, payload: UpdateAdminClaimStatusRequest): Promise<Claim> {
  const claim = await getAdminClaim(claimId);
  return { ...claim, status: payload.status };
}

export async function assignAdminClaim(claimId: string, payload: AssignAdminClaimRequest): Promise<Claim> {
  const claim = await getAdminClaim(claimId);
  return {
    ...claim,
    assignedAgent: {
      id: claim.assignedAgent?.id ?? payload.email,
      name: payload.name,
      email: payload.email,
    } as Claim["assignedAgent"],
  };
}

export async function getAdminClaimStats(): Promise<ClaimStats> {
  const claims = await listAdminClaims();
  const total = claims.length;
  const pending = claims.filter((claim) => ["SUBMITTED", "UNDER_REVIEW"].includes(normalizeClaimStatus(claim.status))).length;
  const inProgress = claims.filter((claim) => normalizeClaimStatus(claim.status) === "PROCESSING").length;
  const resolved = claims.filter((claim) => ["RESOLVED", "CLOSED"].includes(normalizeClaimStatus(claim.status))).length;
  const urgentOpen = claims.filter((claim) => (claim.priority ?? "NORMAL") === "URGENT" && !["RESOLVED", "CLOSED"].includes(normalizeClaimStatus(claim.status))).length;
  const overdue = claims.filter((claim) => claim.slaStatus === "LATE").length;
  const replies = claims
    .filter((claim) => claim.adminReplyAt)
    .map((claim) => (new Date(claim.adminReplyAt as string).getTime() - new Date(claim.createdAt).getTime()) / 36e5)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageFirstResponseHours = replies.length ? replies.reduce((sum, value) => sum + value, 0) / replies.length : 0;
  const lastUpdatedAt = claims[0]?.updatedAt ?? null;
  const createdAt = claims[claims.length - 1]?.createdAt ?? null;

  return { total, pending, inProgress, resolved, urgentOpen, overdue, averageFirstResponseHours, lastUpdatedAt, createdAt };
}
