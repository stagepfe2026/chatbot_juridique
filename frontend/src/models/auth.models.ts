export type UserRole = "ADMIN" | "FINANCE_USER";

export interface AuthUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
}

export interface UpdateProfileRequest {
  nom: string;
  prenom: string;
  email: string;
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
