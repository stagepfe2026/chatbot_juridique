import axios from "axios";
import type { AxiosError } from "axios";
import { publishSnackbar } from "../utils/snackbarBus";
import { publishSessionExpired } from "../utils/sessionExpiredBus";

function extractDetail(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const maybe = data as { detail?: unknown; message?: unknown; error?: unknown };
    const d = maybe.detail ?? maybe.message ?? maybe.error;
    if (typeof d === "string") return d;
  }
  return null;
}

function notifyFromAxiosError(error: AxiosError): void {
  const status = error.response?.status;
  const detail = extractDetail(error.response?.data);

  // Timeout
  const isTimeout = error.code === "ECONNABORTED" || String(error.message || "").toLowerCase().includes("timeout");
  if (isTimeout) {
    publishSnackbar({
      variant: "error",
      message: "La requete a expire (delai depasse). Veuillez reessayer.",
    });
    return;
  }

  if (!status) {
    publishSnackbar({
      variant: "error",
      message: detail || "Erreur reseau. Verifiez votre connexion puis reessayez.",
    });
    return;
  }

  if (status === 401 || status === 403) {
    const requestUrl = String(error.config?.url || "");
    const isLoginRequest = requestUrl.includes("/auth/login");

    if (!isLoginRequest) {
      publishSessionExpired(detail || "Session expiree ou acces refuse. Veuillez vous reconnecter.");
      return;
    }

    publishSnackbar({
      variant: "warning",
      message: detail || "Acces refuse. Veuillez verifier vos identifiants.",
    });
    return;
  }

  if (status >= 400 && status < 500) {
    publishSnackbar({
      variant: "warning",
      message: detail || "Requete invalide. Veuillez verifier les informations.",
    });
    return;
  }

  publishSnackbar({
    variant: "error",
    message: detail || "Erreur serveur. Veuillez reessayer plus tard.",
  });
}

export const httpClient = axios.create({
  baseURL: "/api", // si vous avez un proxy dev vers backend
  withCredentials: true, // si cookies/session
  timeout: 240_000,
});

httpClient.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    const error = err as AxiosError;
    // Allow callers to silence snackbar if needed.
    const silent = Boolean((error.config as { silentSnackbar?: boolean } | undefined)?.silentSnackbar);
    if (!silent) {
      try {
        notifyFromAxiosError(error);
      } catch {
        // ignore
      }
    }
    return Promise.reject(err);
  },
);

