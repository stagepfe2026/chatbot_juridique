export interface AskQuestionRequest {
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
  answer: string;
  sourceFile?: SourceFile | null;
}
