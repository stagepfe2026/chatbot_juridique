import type { Language } from "../translations";
export const sessionTranslations: Record<Language, { endedTitle: string; reconnect: string; expiredDefault: string }> = {
  fr: {
    endedTitle: "Session terminee",
    reconnect: "Se reconnecter",
    expiredDefault: "Session expiree. Veuillez vous reconnecter pour continuer.",
  },
  en: {
    endedTitle: "Session ended",
    reconnect: "Sign in again",
    expiredDefault: "Your session expired. Please sign in again to continue.",
  },
  ar: {
    endedTitle: "\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u062c\u0644\u0633\u0629",
    reconnect: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u062c\u062f\u062f\u0627",
    expiredDefault: "\u0627\u0646\u062a\u0647\u062a \u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u062c\u0644\u0633\u0629. \u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0646 \u062c\u062f\u064a\u062f \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629.",
  },
};