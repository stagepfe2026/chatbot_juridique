export type UserRole = "ADMIN" | "END_USER";

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
}
