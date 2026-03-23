
export type ClaimCategory = "ACCOUNT" | "CHATBOT" | "DOCUMENT" | "OTHER";
export type ClaimStatus = "SUBMITTED" | "ANSWERED";
export type ClaimPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface ClaimAttachment {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface ClaimCreateRequest {
  category: ClaimCategory;
  priority?: ClaimPriority;
  subject: string;
  description: string;
  pageContext?: string;
  attachments: ClaimAttachment[];
}

export interface ClaimReplyRequest {
  message: string;
}

export interface Claim {
  id: string;
  userId: string;
  userEmail: string;
  category: ClaimCategory;
  priority?: ClaimPriority;
  subject: string;
  description: string;
  pageContext?: string;
  status: ClaimStatus;
  attachments: ClaimAttachment[];
  adminReply: string | null;
  adminReplyAt: string | null;
  adminReplyBy: string | null;
  isReplyReadByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimUnreadCount {
  count: number;
}

