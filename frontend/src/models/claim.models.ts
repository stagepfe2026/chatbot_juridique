export type ClaimCategory = "ACCOUNT" | "CHATBOT" | "DOCUMENT" | "OTHER";
export type ClaimStatus = "SUBMITTED" | "UNDER_REVIEW" | "PROCESSING" | "RESOLVED" | "CLOSED" | "ANSWERED";
export type ClaimPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ClaimSlaStatus = "ON_TIME" | "LATE";
export type ClaimMessageAuthorType = "USER" | "ADMIN" | "SYSTEM";

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

export interface ClaimAssignedAgent {
  id: string;
  name: string;
}

export interface ClaimConversationMessage {
  id: string;
  authorType: ClaimMessageAuthorType;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface ClaimActivityLogEntry {
  id: string;
  description: string;
  actorName: string;
  createdAt: string;
}

export interface ClaimBinaryAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export interface Claim {
  id: string;
  ticketNumber?: string;
  userId: string;
  userEmail: string;
  category: ClaimCategory;
  priority?: ClaimPriority;
  subject: string;
  description: string;
  pageContext?: string;
  pageLink?: string;
  status: ClaimStatus;
  attachments: ClaimAttachment[];
  attachment?: ClaimBinaryAttachment | null;
  adminReply: string | null;
  adminReplyAt: string | null;
  adminReplyBy: string | null;
  isReplyReadByUser: boolean;
  createdAt: string;
  updatedAt: string;
  assignedAgent?: ClaimAssignedAgent | null;
  slaStatus?: ClaimSlaStatus;
  dueAt?: string | null;
  messageCount?: number;
  lastAdminReplyPreview?: string | null;
  messages?: ClaimConversationMessage[];
  activityLog?: ClaimActivityLogEntry[];
}

export type ClaimListItem = Claim;

export interface ClaimUnreadCount {
  count: number;
}

export const claimCategoryLabels: Record<ClaimCategory, string> = {
  ACCOUNT: "Compte",
  CHATBOT: "Chatbot",
  DOCUMENT: "Document",
  OTHER: "Autre",
};

export const claimPriorityLabels: Record<ClaimPriority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export const claimStatusLabels: Record<ClaimStatus, string> = {
  SUBMITTED: "Soumise",
  UNDER_REVIEW: "En cours d'analyse",
  PROCESSING: "En traitement",
  RESOLVED: "Resolue",
  CLOSED: "Fermee",
  ANSWERED: "Resolue",
};

export const claimSlaLabels: Record<ClaimSlaStatus, string> = {
  ON_TIME: "Dans les delais",
  LATE: "Hors delai",
};
