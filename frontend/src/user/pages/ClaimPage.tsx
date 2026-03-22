import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createClaim } from "../../services/claims.service";
import { publishSnackbar } from "../../utils/snackbarBus";
import type { ClaimCategory } from "../../models/claim.models";

const categories: Array<{ value: ClaimCategory; label: string }> = [
  { value: "ACCOUNT", label: "Compte" },
  { value: "CHATBOT", label: "Chatbot" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "OTHER", label: "Autre" },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.6">
      {children}
    </svg>
  );
}

export default function ClaimPage() {
  const [category, setCategory] = useState<ClaimCategory>("CHATBOT");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.value === category),
    [category]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (subject.trim().length < 3) {
      setError("Sujet trop court.");
      return;
    }

    if (description.trim().length < 10) {
      setError("Description insuffisante.");
      return;
    }

    try {
      setLoading(true);
      await createClaim({ category, subject, description });
      setSubject("");
      setDescription("");
      publishSnackbar({ variant: "success", message: "Réclamation envoyée." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl grid gap-5">

      {/* HEADER SIMPLE */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Nouvelle réclamation</h1>
        <p className="text-sm text-slate-500">
          Signalez un problème rencontré.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">

        {/* FORM */}
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-red-100 bg-white p-5 shadow-sm grid gap-4"
        >
          {/* Category + Subject */}
          <div className="grid gap-3 md:grid-cols-2">

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-600">Catégorie</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ClaimCategory)}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-600">Sujet</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                placeholder="Résumé du problème"
              />
            </label>

          </div>

          {/* DESCRIPTION */}
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-600">Description</span>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder="Décrivez le problème..."
            />
          </label>

          {/* ERROR / INFO */}
          {error ? (
            <div className="text-xs text-red-600 font-medium">{error}</div>
          ) : (
            <div className="text-xs text-slate-400">
              Plus votre description est précise, plus le traitement sera rapide.
            </div>
          )}

          {/* ACTION */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </form>

        {/* SIDE PANEL (LIGHT) */}
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-800">
            {selectedCategory?.label}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Choisissez la catégorie correspondant à votre problème pour un traitement rapide.
          </p>

          <div className="mt-4 grid gap-2">
            {categories.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition ${
                  category === c.value
                    ? "bg-red-50 text-red-600"
                    : "hover:bg-slate-50 text-slate-600"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </aside>

      </div>
    </div>
  );
}