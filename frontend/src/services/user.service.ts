import { httpClient } from "./httpClient";
import type { AskQuestionRequest, AskQuestionResponse, QuestionSuggestion, SourceItem } from "../models/chat.models";
import type { ConversationMessage, ConversationSummary } from "../models/conversation.models";

export async function askQuestion(payload: AskQuestionRequest): Promise<AskQuestionResponse> {
  const res = await httpClient.post<AskQuestionResponse>("/chat/questions", payload);
  return res.data;
}

export async function getSources(questionId: string): Promise<SourceItem[]> {
  const res = await httpClient.get<SourceItem[]>(`/chat/questions/${questionId}/sources`);
  return res.data;
}

export async function listMyConversations(): Promise<ConversationSummary[]> {
  const res = await httpClient.get<ConversationSummary[]>("/chat/conversations");
  return Array.isArray(res.data) ? res.data : [];
}

export async function getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const res = await httpClient.get<ConversationMessage[]>(`/chat/conversations/${conversationId}/messages`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getQuestionSuggestions(query: string, limit = 5): Promise<QuestionSuggestion[]> {
  const res = await httpClient.get<QuestionSuggestion[]>("/chat/suggestions", { params: { query, limit } });
  return Array.isArray(res.data) ? res.data : [];
}

