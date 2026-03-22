import type { SourceFile } from "./chat.models";

export interface Conversation {
  id: string;
  question: string;
  answer: string;
  askedAt: string;
  answeredAt: string;
  createdAt: string;
  userId: string | null;
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  isArchived: boolean;
  archivedAt?: string | null;
}

export interface ConversationArchiveState {
  conversationId: string;
  isArchived: boolean;
  archivedAt?: string | null;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  questionId?: string | null;
  sourceFile?: SourceFile | null;
}
