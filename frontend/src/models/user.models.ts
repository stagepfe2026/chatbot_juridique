export type UserRole = "ADMIN" | "FINANCE_USER";

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
}
