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

function variantClasses(variant: SnackbarVariant): string {
  if (variant === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (variant === "error") return "border-red-200 bg-red-50 text-red-700";
  if (variant === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);

  useEffect(() => {
    return subscribeSnackbar((payload) => {
      const next = normalizePayload(payload);
      setItems((prev) => [...prev.slice(-2), next]);

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
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.16)] ${variantClasses(it.variant)}`}
          role={it.variant === "error" ? "alert" : "status"}
          aria-live={it.variant === "error" ? "assertive" : "polite"}
        >
          <span className="min-w-0 text-sm font-semibold">{it.message}</span>
          <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-current/10 bg-white/60 text-lg leading-none" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
            ×
          </button>
        </div>
      )),
    [items],
  );

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-[95] grid max-w-[calc(100vw-2rem)] gap-3 sm:max-w-md" aria-hidden={items.length === 0}>
        {rendered}
      </div>
    </>
  );
}
