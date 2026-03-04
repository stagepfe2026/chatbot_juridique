export interface AskQuestionRequest {
  conversationId?: string;
  question: string;
}

export interface SourceItem {
  documentId: string;
  title: string;
  excerpt: string;
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
