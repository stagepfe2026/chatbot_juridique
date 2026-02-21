export interface AskQuestionRequest {
  question: string;
}

export interface SourceItem {
  documentId: number;
  title: string;
  excerpt: string;
}

export interface AskQuestionResponse {
  questionId: number;
  answer: string;
  sources: SourceItem[];
}
