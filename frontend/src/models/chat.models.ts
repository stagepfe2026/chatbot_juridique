export type ResponseMode = "SHORT" | "DETAILED";

export interface AskQuestionRequest {
  conversationId?: string;
  question: string;
  responseMode?: ResponseMode;
}

export interface SourceItem {
  documentId: string;
  title: string;
  excerpt: string;
  section?: string | null;
  page?: string | null;
}

export interface SourceFile {
  documentId: string;
  filename: string;
  downloadUrl: string;
}

export interface AskQuestionResponse {
  questionId: string;
  conversationId: string;
  answer: string;
  sources?: SourceItem[];
  sourceFile?: SourceFile | null;
}

export type QuestionSuggestion = string;
