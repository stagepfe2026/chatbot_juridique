import { httpClient } from "./httpClient";
import type { Claim, ClaimCreateRequest, ClaimReplyRequest, ClaimUnreadCount } from "../models/claim.models";

export async function createClaim(payload: ClaimCreateRequest): Promise<Claim> {
  const res = await httpClient.post<Claim>("/claims", payload);
  return res.data;
}

export async function listMyClaims(): Promise<Claim[]> {
  const res = await httpClient.get<Claim[]>("/claims/me");
  return Array.isArray(res.data) ? res.data : [];
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

