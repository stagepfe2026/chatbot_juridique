import { httpClient } from "./httpClient";
import type { Claim, ClaimCreateRequest } from "../models/claim.models";

export async function createClaim(payload: ClaimCreateRequest): Promise<Claim> {
  const res = await httpClient.post<Claim>("/claims", payload);
  return res.data;
}
