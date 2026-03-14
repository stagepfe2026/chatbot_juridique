import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { subscribeSnackbar } from "../utils/snackbarBus";
import type { SnackbarPayload, SnackbarVariant } from "../utils/snackbarBus";

type SnackbarItem = {
  id: string;
  message: string;
  variant: SnackbarVariant;
  durationMs: number;
};

function normalizePayload(payload: SnackbarPayload): SnackbarItem {
  const variant: SnackbarVariant = payload.variant ?? "info";
  const base = variant === "error" ? 6000 : variant === "warning" ? 5000 : 3800;
  const durationMs = Math.max(1200, payload.durationMs ?? base);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message: String(payload.message ?? "").trim() || "Une erreur est survenue.",
    variant,
    durationMs,
  };
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);

  useEffect(() => {
    return subscribeSnackbar((payload) => {
      const next = normalizePayload(payload);
      setItems((prev) => {
        const trimmed = prev.slice(-2);
        return [...trimmed, next];
      });

      window.setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== next.id));
      }, next.durationMs);
    });
  }, []);

  const rendered = useMemo(
    () =>
      items.map((it) => (
        <div
          key={it.id}
          className={`snackbar snackbar--${it.variant}`}
          role={it.variant === "error" ? "alert" : "status"}
          aria-live={it.variant === "error" ? "assertive" : "polite"}
        >
          <span className="snackbar__msg">{it.message}</span>
          <button type="button" className="snackbar__close" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
            ×
          </button>
        </div>
      )),
    [items],
  );

  return (
    <>
      {children}
      <div className="snackbar-host" aria-hidden={items.length === 0}>
        {rendered}
      </div>
    </>
  );
}
