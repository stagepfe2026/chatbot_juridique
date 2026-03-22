import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { updateCurrentUserPassword } from "../../services/auth.service";
import { publishSnackbar } from "../../utils/snackbarBus";

type FormState = {
  nom: string;
  prenom: string;
  email: string;
};

type PasswordState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildInitials(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase() || "US";
}

export default function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [form, setForm] = useState<FormState>({ nom: "", prenom: "", email: "" });
  const [passwordForm, setPasswordForm] = useState<PasswordState>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({ nom: user.nom, prenom: user.prenom, email: user.email });
  }, [user]);

  const isDirty =
    form.nom !== (user?.nom ?? "") ||
    form.prenom !== (user?.prenom ?? "") ||
    form.email !== (user?.email ?? "");

  const fullName = useMemo(() => `${form.prenom} ${form.nom}`.trim() || "Utilisateur", [form]);
  const initials = useMemo(() => buildInitials(form.prenom, form.nom), [form]);
  const roleLabel = user?.role === "ADMIN" ? "Administrateur" : "Utilisateur finance";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nom || !form.prenom || !form.email) {
      setError("Tous les champs sont obligatoires.");
      return;
    }

    if (!isValidEmail(form.email)) {
      setError("Email invalide.");
      return;
    }

    try {
      setSaving(true);
      await updateCurrentUser(form);
      publishSnackbar({ variant: "success", message: "Profil mis a jour." });
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Tous les champs sont obligatoires.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Min 8 caracteres.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Confirmation incorrecte.");
      return;
    }

    try {
      setSavingPassword(true);
      await updateCurrentUserPassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      publishSnackbar({ variant: "success", message: "Mot de passe mis a jour." });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl grid gap-5">
      <section className="rounded-2xl border border-red-100 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
            {initials}
          </div>

          <div>
            <h1 className="text-lg font-bold text-slate-900">{fullName}</h1>
            <div className="mt-1 flex gap-3 text-xs text-slate-500">
              <span>{form.email}</span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">{roleLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-red-100 bg-white p-2 shadow-sm">
        <div className="inline-flex rounded-xl bg-red-50 p-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeTab === "profile" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"}`}
          >
            Profil
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeTab === "security" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"}`}
          >
            Securite
          </button>
        </div>
      </section>

      {activeTab === "profile" ? (
        <section className="rounded-2xl border border-red-100 bg-white shadow-sm">
          <div className="border-b px-5 py-3 text-sm font-semibold text-slate-800">Informations personnelles</div>

          <form onSubmit={onSubmit} className="grid gap-4 px-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
              <input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prenom" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
            </div>

            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@organisation.tn" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />

            {error ? <div className="text-xs text-red-600">{error}</div> : null}

            <div className="flex justify-end">
              <button disabled={saving || !isDirty} className="rounded-lg bg-red-600 px-4 py-2 text-xs text-white hover:bg-red-700 disabled:opacity-60">
                {saving ? "..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl border border-red-100 bg-white shadow-sm">
          <div className="border-b px-5 py-3 text-sm font-semibold text-slate-800">Securite</div>

          <form onSubmit={onSubmitPassword} className="grid gap-4 px-5 py-4">
            <input type="password" placeholder="Mot de passe actuel" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
            <input type="password" placeholder="Nouveau mot de passe" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
            <input type="password" placeholder="Confirmer" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />

            {passwordError ? <div className="text-xs text-red-600">{passwordError}</div> : null}

            <div className="flex justify-end">
              <button disabled={savingPassword} className="rounded-lg bg-red-600 px-4 py-2 text-xs text-white hover:bg-red-700">
                {savingPassword ? "..." : "Mettre a jour"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
