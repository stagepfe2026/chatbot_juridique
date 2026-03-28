export type UserRole = "ADMIN" | "FINANCE_USER";

export interface LoginHistoryEntry {
  device: string;
  browser: string;
  location: string;
  lastSeenAt: string;
  isCurrent: boolean;
  isSuspicious: boolean;
}

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  telephone: string;
  profileImageUrl: string;
  adresse: string;
  dateNaissance: string;
  direction: string;
  service: string;
  poste: string;
  matricule: string;
  bureau: string;
  responsable: string;
  membreDepuis: string;
  languePreferee: "fr" | "en" | "ar";
  themePrefere: "light" | "dark";
  notificationsEmail: boolean;
  notificationsSms: boolean;
  twoFactorEnabled: boolean;
  passwordUpdatedAt: string;
  activeSessionsCount: number;
  loginHistory: LoginHistoryEntry[];
}
