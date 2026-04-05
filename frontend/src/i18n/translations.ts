import { claimsTranslations } from './modules/claims';
import { commonTranslations } from './modules/common';
import { claimCategoryTranslations, claimPriorityTranslations, claimStatusTranslations, documentCategoryTranslations } from './modules/labels';
import { profileTranslations } from './modules/profile';
import { searchDocsTranslations } from './modules/searchDocs';
import { sessionTranslations } from './modules/session';

export type Language = 'fr' | 'en' | 'ar';

export const translations = {
  fr: {
    session: sessionTranslations.fr,
    common: commonTranslations.fr,
    profile: profileTranslations.fr,
    claims: claimsTranslations.fr,
    searchDocs: searchDocsTranslations.fr,
  },
  en: {
    session: sessionTranslations.en,
    common: commonTranslations.en,
    profile: profileTranslations.en,
    claims: claimsTranslations.en,
    searchDocs: searchDocsTranslations.en,
  },
  ar: {
    session: sessionTranslations.ar,
    common: commonTranslations.ar,
    profile: profileTranslations.ar,
    claims: claimsTranslations.ar,
    searchDocs: searchDocsTranslations.ar,
  },
} as const;

export type TranslationKey = string;

export {
  claimCategoryTranslations,
  claimPriorityTranslations,
  claimStatusTranslations,
  documentCategoryTranslations,
};