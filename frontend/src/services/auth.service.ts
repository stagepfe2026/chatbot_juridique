import { httpClient } from "./httpClient";
import type { AuthUser, LoginRequest, LoginResponse } from "../models/auth.models";

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await httpClient.post<LoginResponse>("/auth/login", payload);
  return res.data;
}

export async function logout(): Promise<void> {
  await httpClient.post("/auth/logout");
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await httpClient.get<AuthUser>("/auth/me");
  return res.data;
}
