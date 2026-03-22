export type ClaimCategory = "ACCOUNT" | "CHATBOT" | "DOCUMENT" | "OTHER";
export type ClaimStatus = "SUBMITTED";

export interface ClaimCreateRequest {
  category: ClaimCategory;
  subject: string;
  description: string;
}

export interface Claim {
  id: string;
  userId: string;
  userEmail: string;
  category: ClaimCategory;
  subject: string;
  description: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
}
