import { httpClient } from "./httpClient";
import type { AuthUser, DisconnectDevicesResponse, LoginRequest, LoginResponse, UpdatePasswordRequest, UpdateProfileRequest } from "../models/auth.models";

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await httpClient.post<LoginResponse>("/auth/login", payload);
  return res.data;
}

export async function logout(): Promise<void> {
  await httpClient.post("/auth/logout");
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await httpClient.get("/auth/me", { silentSnackbar: true } as any);
  return res.data as AuthUser;
}

export async function updateCurrentUser(payload: UpdateProfileRequest): Promise<AuthUser> {
  const res = await httpClient.put<AuthUser>("/auth/me", payload);
  return res.data;
}

export async function updateCurrentUserPassword(payload: UpdatePasswordRequest): Promise<void> {
  await httpClient.put("/auth/me/password", payload);
}

export async function disconnectAllDevices(): Promise<DisconnectDevicesResponse> {
  const res = await httpClient.post<DisconnectDevicesResponse>("/auth/me/disconnect-all-devices");
  return res.data;
}
