import type { ClaimCategory, ClaimPriority, ClaimStatus } from "../../models/claim.models";
import type { DocumentCategory } from "../../models/document.models";
import type { Language } from "../translations";

export const documentCategoryTranslations: Record<Language, Record<DocumentCategory, string>> = {
  fr: {
    LOI_DES_FINANCES: "Loi des finances",
    RECUEILS_DES_TEXTES_FISCAUX: "Recueils des textes fiscaux",
    NOTE_COMMUNES: "Notes communes",
    CONVENTIONS_DE_NON_DOUBLE_IMPOSITION: "Conventions de non double imposition",
  },
  en: {
    LOI_DES_FINANCES: "Finance law",
    RECUEILS_DES_TEXTES_FISCAUX: "Tax text collections",
    NOTE_COMMUNES: "Common notes",
    CONVENTIONS_DE_NON_DOUBLE_IMPOSITION: "Double taxation agreements",
  },
  ar: {
    LOI_DES_FINANCES: "\u0642\u0627\u0646\u0648\u0646 \u0627\u0644\u0645\u0627\u0644\u064a\u0629",
    RECUEILS_DES_TEXTES_FISCAUX: "\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u062c\u0628\u0627\u0626\u064a\u0629",
    NOTE_COMMUNES: "\u0627\u0644\u0645\u0630\u0643\u0631\u0627\u062a \u0627\u0644\u0645\u0634\u062a\u0631\u0643\u0629",
    CONVENTIONS_DE_NON_DOUBLE_IMPOSITION: "\u0627\u062a\u0641\u0627\u0642\u064a\u0627\u062a \u0639\u062f\u0645 \u0627\u0644\u0627\u0632\u062f\u0648\u0627\u062c \u0627\u0644\u0636\u0631\u064a\u0628\u064a",
  },
};

export const claimCategoryTranslations: Record<Language, Record<ClaimCategory, string>> = {
  fr: { ACCOUNT: "Compte", CHATBOT: "Chatbot", DOCUMENT: "Document", OTHER: "Autre" },
  en: { ACCOUNT: "Account", CHATBOT: "Chatbot", DOCUMENT: "Document", OTHER: "Other" },
  ar: { ACCOUNT: "\u0627\u0644\u062d\u0633\u0627\u0628", CHATBOT: "\u0627\u0644\u0645\u0633\u0627\u0639\u062f", DOCUMENT: "\u0627\u0644\u0648\u062b\u0627\u0626\u0642", OTHER: "\u0623\u062e\u0631\u0649" },
};

export const claimPriorityTranslations: Record<Language, Record<ClaimPriority, string>> = {
  fr: { LOW: "Basse", NORMAL: "Normale", HIGH: "Haute", URGENT: "Urgente" },
  en: { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" },
  ar: { LOW: "\u0645\u0646\u062e\u0641\u0636\u0629", NORMAL: "\u0639\u0627\u062f\u064a\u0629", HIGH: "\u0645\u0631\u062a\u0641\u0639\u0629", URGENT: "\u0645\u0633\u062a\u0639\u062c\u0644\u0629" },
};

export const claimStatusTranslations: Record<Language, Record<ClaimStatus, string>> = {
  fr: { SUBMITTED: "Soumise", UNDER_REVIEW: "En cours d'analyse", PROCESSING: "En traitement", RESOLVED: "Resolue", CLOSED: "Fermee", ANSWERED: "Resolue" },
  en: { SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", PROCESSING: "Processing", RESOLVED: "Resolved", CLOSED: "Closed", ANSWERED: "Resolved" },
  ar: { SUBMITTED: "\u0645\u0631\u0633\u0644\u0629", UNDER_REVIEW: "\u0642\u064a\u062f \u0627\u0644\u062f\u0631\u0627\u0633\u0629", PROCESSING: "\u0642\u064a\u062f \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629", RESOLVED: "\u062a\u0645 \u062d\u0644\u0647\u0627", CLOSED: "\u0645\u063a\u0644\u0642\u0629", ANSWERED: "\u062a\u0645 \u062d\u0644\u0647\u0627" },
};
