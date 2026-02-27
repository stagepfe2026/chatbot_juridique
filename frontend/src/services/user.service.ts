import { httpClient } from "./httpClient";
import type { AskQuestionRequest, AskQuestionResponse, SourceItem } from "../models/chat.models";

export async function askQuestion(payload: AskQuestionRequest): Promise<AskQuestionResponse> {
  const res = await httpClient.post<AskQuestionResponse>("/chat/questions", payload);
  return res.data;
}

export async function getSources(questionId: string): Promise<SourceItem[]> {
  const res = await httpClient.get<SourceItem[]>(`/chat/questions/${questionId}/sources`);
  return res.data;
}
