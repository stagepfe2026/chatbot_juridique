export type UserRole = "ADMIN" | "FINANCE_USER";

export interface LoginHistoryEntry {
  device: string;
  browser: string;
  location: string;
  lastSeenAt: string;
  isCurrent: boolean;
  isSuspicious: boolean;
}

export interface AuthUser {
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

export interface UpdateProfileRequest {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
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
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  sessionExpiresAt: string;
}

export interface DisconnectDevicesResponse {
  closedSessions: number;
}
