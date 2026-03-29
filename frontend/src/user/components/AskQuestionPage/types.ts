import type { ReactNode } from "react";
import type { SourceFile, SourceItem } from "../../../models/chat.models";
import type { ConversationSummary } from "../../../models/conversation.models";

export type AskQuestionLabelsLike = {
  newConversation: string;
  myArchives: string;
  activeConversations: string;
  actionsFor: string;
  rename: string;
  archive: string;
  archiving: string;
  delete: string;
  deleting: string;
  noActiveConversations: string;
  legalAssistant: string;
  searchConversation: string;
  copy: string;
  sourceDocument: string;
  helpful: string;
  notHelpful: string;
  report: string;
  noSearchResults: string;
  responseMode: string;
  short: string;
  detailed: string;
  shortSummary: string;
  detailedSummary: string;
  askPlaceholder: string;
  suggestionsAria: string;
  suggestionsLoading: string;
  noSuggestions: string;
  renameHint: string;
  newName: string;
  cancel: string;
  saving: string;
  save: string;
  archivedCount: (n: number) => string;
  close: string;
  noArchived: string;
  restoring: string;
  restore: string;
};

export type ChatMessageLike = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  questionId?: string | null;
  sourceFile?: SourceFile | null;
  sources?: SourceItem[];
};

export type IconComponent = (props: { children: ReactNode; size?: number }) => ReactNode;
export type ConversationItem = ConversationSummary;
