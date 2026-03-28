import { httpClient } from "./httpClient";
import type { Claim, ClaimCreateRequest, ClaimReplyRequest, ClaimStatus, ClaimUnreadCount } from "../models/claim.models";

export interface ListMyClaimsFilters {
  status?: ClaimStatus | "";
  search?: string;
  createdFrom?: string;
  createdTo?: string;
}

export async function createClaim(payload: ClaimCreateRequest): Promise<Claim> {
  const res = await httpClient.post<Claim>("/claims", payload);
  return res.data;
}

export async function listMyClaims(filters?: ListMyClaimsFilters): Promise<Claim[]> {
  const res = await httpClient.get<Claim[]>("/claims/me");
  const rows = Array.isArray(res.data) ? res.data : [];

  if (!filters) {
    return rows;
  }

  const query = filters.search?.trim().toLocaleLowerCase("fr-FR") ?? "";
  const fromDate = filters.createdFrom ? new Date(`${filters.createdFrom}T00:00:00`).getTime() : null;
  const toDate = filters.createdTo ? new Date(`${filters.createdTo}T23:59:59`).getTime() : null;

  return rows.filter((claim) => {
    if (filters.status && claim.status !== filters.status) {
      return false;
    }

    if (query) {
      const haystack = [claim.subject, claim.description, claim.adminReply, claim.pageContext]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr-FR");
      if (!haystack.includes(query)) {
        return false;
      }
    }

    const createdAt = new Date(claim.createdAt).getTime();
    if (fromDate !== null && createdAt < fromDate) {
      return false;
    }
    if (toDate !== null && createdAt > toDate) {
      return false;
    }

    return true;
  });
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

export async function listAdminClaims(): Promise<Claim[]> {
  const res = await httpClient.get<Claim[]>("/admin/claims");
  return Array.isArray(res.data) ? res.data : [];
}

export async function replyToClaim(claimId: string, payload: ClaimReplyRequest): Promise<Claim> {
  const res = await httpClient.post<Claim>(`/admin/claims/${claimId}/reply`, payload);
  return res.data;
}
