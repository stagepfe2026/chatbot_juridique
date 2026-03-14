export type SnackbarVariant = "success" | "info" | "warning" | "error";

export type SnackbarPayload = {
  message: string;
  variant?: SnackbarVariant;
  durationMs?: number;
};

type Listener = (payload: SnackbarPayload) => void;

const listeners = new Set<Listener>();

export function publishSnackbar(payload: SnackbarPayload): void {
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeSnackbar(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
