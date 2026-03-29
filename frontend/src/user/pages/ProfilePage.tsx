import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FormEvent, ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";
import { disconnectAllDevices, updateCurrentUserPassword } from "../../services/auth.service";
import { useI18n } from "../../i18n/I18nContext";
import { listMyClaims } from "../../services/claims.service";
import { getFavoriteDocumentsCount, listFavoriteDocuments } from "../../services/userDocuments.service";
import { listMyConversations } from "../../services/user.service";
import { publishSnackbar } from "../../utils/snackbarBus";
import type { AuthUser, LoginHistoryEntry, UpdateProfileRequest } from "../../models/auth.models";
import type { Language } from "../../i18n/translations";

type FormState = UpdateProfileRequest;

type PasswordState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ActivitySummary = {
  documents: number;
  conversations: number;
  claims: number;
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildInitials(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase() || "US";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toFormState(user: AuthUser): FormState {
  return {
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    telephone: user.telephone,
    adresse: user.adresse,
    dateNaissance: user.dateNaissance,
    direction: user.direction,
    service: user.service,
    poste: user.poste,
    matricule: user.matricule,
    bureau: user.bureau,
    responsable: user.responsable,
    membreDepuis: user.membreDepuis,
    languePreferee: user.languePreferee,
    themePrefere: user.themePrefere,
    notificationsEmail: user.notificationsEmail,
    notificationsSms: user.notificationsSms,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

type ProfilePdfLabels = {
  title: string;
  exportedAt: string;
  fullName: string;
  role: string;
  contactSection: string;
  professionalSection: string;
  preferencesSection: string;
  activitySection: string;
  sessionsSection: string;
  favoriteDocumentsSection: string;
  conversationsSection: string;
  claimsSection: string;
};

function buildExportFilename(prenom: string, nom: string) {
  const safeName = `${(prenom || "user")}-${(nom || "data")}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profil";
  return `${safeName}-donnees-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function downloadProfilePdf({
  fileName,
  locale,
  labels,
  profileRows,
  professionalRows,
  preferenceRows,
  activityRows,
  sessionRows,
  favoriteDocumentRows,
  conversationRows,
  claimRows,
}: {
  fileName: string;
  locale: string;
  labels: ProfilePdfLabels;
  profileRows: Array<[string, string]>;
  professionalRows: Array<[string, string]>;
  preferenceRows: Array<[string, string]>;
  activityRows: Array<[string, string]>;
  sessionRows: string[][];
  favoriteDocumentRows: string[][];
  conversationRows: string[][];
  claimRows: string[][];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const exportDate = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date());

  doc.setFillColor(185, 28, 28);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(labels.title, 14, 13);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`${labels.exportedAt}: ${exportDate}`, 14, 30);
  doc.text(`${labels.fullName}: ${profileRows[0]?.[1] ?? "-"}`, 14, 36);
  doc.text(`${labels.role}: ${professionalRows[2]?.[1] ?? "-"}`, 14, 42);

  let cursorY = 48;

  const addSectionTitle = (title: string) => {
    doc.setFontSize(12);
    doc.setTextColor(185, 28, 28);
    doc.text(title, 14, cursorY);
    cursorY += 4;
  };

  const addKeyValueTable = (rows: Array<[string, string]>, startY: number) => {
    autoTable(doc, {
      startY,
      head: [["Champ", "Valeur"]],
      body: rows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [51, 65, 85] },
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    return (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? startY + 20;
  };

  const addListTable = (title: string, head: string[], rows: string[][]) => {
    addSectionTitle(title);
    autoTable(doc, {
      startY: cursorY,
      head: [head],
      body: rows.length ? rows : [["-", "-", "-"]],
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8.5, cellPadding: 2.3, textColor: [51, 65, 85] },
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    cursorY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY + 18) + 8;
  };

  addSectionTitle(labels.contactSection);
  cursorY = addKeyValueTable(profileRows, cursorY) + 8;
  addSectionTitle(labels.professionalSection);
  cursorY = addKeyValueTable(professionalRows, cursorY) + 8;
  addSectionTitle(labels.preferencesSection);
  cursorY = addKeyValueTable(preferenceRows, cursorY) + 8;
  addSectionTitle(labels.activitySection);
  cursorY = addKeyValueTable(activityRows, cursorY) + 8;

  addListTable(labels.sessionsSection, ["Appareil", "Navigateur / Lieu", "Derniere activite"], sessionRows);
  addListTable(labels.favoriteDocumentsSection, ["Titre", "Categorie", "Date"], favoriteDocumentRows);
  addListTable(labels.conversationsSection, ["Titre", "Messages", "Mise a jour"], conversationRows);
  addListTable(labels.claimsSection, ["Sujet", "Statut", "Mise a jour"], claimRows);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${page} / ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 7, { align: "right" });
  }

  doc.save(fileName);
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function ProfilePage() {
  const { user, updateCurrentUser, logout } = useAuth();
  const { t, locale, setLanguage } = useI18n();
  const [form, setForm] = useState<FormState | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordState>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [activity, setActivity] = useState<ActivitySummary>({ documents: 0, conversations: 0, claims: 0 });
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [disconnectingDevices, setDisconnectingDevices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordUpdatedAtOverride, setPasswordUpdatedAtOverride] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm(toFormState(user));
  }, [user]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.profileImageUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadActivity() {
      try {
        setLoadingActivity(true);
        const [conversations, documents, claims] = await Promise.all([listMyConversations(), getFavoriteDocumentsCount(), listMyClaims()]);
        if (cancelled) return;
        setActivity({ documents, conversations: conversations.length, claims: claims.filter((claim) => claim.status !== "CLOSED").length });
      } finally {
        if (!cancelled) setLoadingActivity(false);
      }
    }
    void loadActivity();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = useMemo(() => buildInitials(form?.prenom ?? user?.prenom ?? "", form?.nom ?? user?.nom ?? ""), [form, user]);
  const avatarUrl = user?.profileImageUrl?.trim() || (user?.role === "ADMIN" ? "https://randomuser.me/api/portraits/men/46.jpg" : "https://randomuser.me/api/portraits/men/32.jpg");
  const fullName = useMemo(() => `${form?.prenom ?? user?.prenom ?? ""} ${form?.nom ?? user?.nom ?? ""}`.trim() || "Utilisateur", [form, user]);
  const isDirty = useMemo(() => {
    if (!user || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(toFormState(user));
  }, [form, user]);

  async function onSubmitProfile(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);

    if (!form.nom || !form.prenom || !form.email || !form.telephone || !form.adresse || !form.dateNaissance || !form.direction || !form.service || !form.poste || !form.matricule || !form.bureau || !form.responsable || !form.membreDepuis) {
      setError(t("profile.allFieldsRequired"));
      return;
    }

    if (!isValidEmail(form.email)) {
      setError(t("profile.invalidEmail"));
      return;
    }

    try {
      setSavingProfile(true);
      await updateCurrentUser(form);
      publishSnackbar({ variant: "success", message: t("profile.profileUpdated") });
      setIsProfileModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError(t("profile.passwordFieldsRequired"));
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError(t("profile.minPassword"));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("profile.invalidConfirmation"));
      return;
    }

    try {
      setSavingPassword(true);
      await updateCurrentUserPassword(passwordForm);
      setPasswordUpdatedAtOverride(new Date().toISOString());
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      publishSnackbar({ variant: "success", message: t("profile.passwordUpdated") });
      setIsPasswordModalOpen(false);
    } finally {
      setSavingPassword(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateLanguageField(value: Language) {
    updateField("languePreferee", value);
    setLanguage(value);
  }

  async function onDownloadData() {
    const currentUser = user;
    const currentForm = form;
    if (!currentUser || !currentForm) return;

    try {
      setDownloadingData(true);
      const [favoriteDocuments, conversations, claims] = await Promise.all([
        listFavoriteDocuments(100),
        listMyConversations(),
        listMyClaims(),
      ]);

      const yesLabel = t("common.yes");
      const noLabel = t("common.no");
      const fileName = buildExportFilename(currentForm.prenom, currentForm.nom);

      downloadProfilePdf({
        fileName,
        locale,
        labels: {
          title: t("profile.downloadData"),
          exportedAt: t("common.page") === "Page" ? "Exporte le" : t("common.page") === "??????" ? "????? ???????" : "Exported at",
          fullName: t("profile.personalInfo"),
          role: t("profile.role"),
          contactSection: t("profile.personalInfo"),
          professionalSection: t("profile.professionalInfo"),
          preferencesSection: t("profile.preferences"),
          activitySection: t("profile.activity"),
          sessionsSection: t("profile.connectionsHistory"),
          favoriteDocumentsSection: t("profile.documents"),
          conversationsSection: t("profile.conversations"),
          claimsSection: t("profile.claims"),
        },
        profileRows: [
          ["Nom complet", `${currentForm.prenom} ${currentForm.nom}`.trim() || "-"],
          [t("profile.email"), currentForm.email || "-"],
          [t("profile.phone"), currentForm.telephone || "-"],
          [t("profile.address"), currentForm.adresse || "-"],
          [t("profile.birthDate"), formatDate(currentForm.dateNaissance, locale) || currentForm.dateNaissance || "-"],
        ],
        professionalRows: [
          [t("profile.department"), currentForm.direction || "-"],
          ["Service", currentForm.service || "-"],
          [t("profile.role"), currentForm.poste || "-"],
          ["Matricule", currentForm.matricule || "-"],
          [t("profile.office"), currentForm.bureau || "-"],
          [t("profile.manager"), currentForm.responsable || "-"],
          [t("profile.memberSince"), formatDate(currentForm.membreDepuis, locale) || currentForm.membreDepuis || "-"],
        ],
        preferenceRows: [
          [t("profile.language"), currentForm.languePreferee],
          [t("profile.theme"), currentForm.themePrefere],
          [t("profile.emailNotifications"), currentForm.notificationsEmail ? yesLabel : noLabel],
          [t("profile.smsNotifications"), currentForm.notificationsSms ? yesLabel : noLabel],
          [t("profile.twoFactor"), currentForm.twoFactorEnabled ? yesLabel : noLabel],
        ],
        activityRows: [
          [t("profile.documents"), String(favoriteDocuments.length)],
          [t("profile.conversations"), String(conversations.length)],
          [t("profile.claims"), String(claims.length)],
          [t("profile.activeSessions"), String(currentUser.activeSessionsCount)],
        ],
        sessionRows: currentUser.loginHistory.map((entry) => [
          entry.device || "-",
          `${entry.browser || "-"} / ${entry.location || "-"}`,
          formatDateTime(entry.lastSeenAt, locale) || "-",
        ]),
        favoriteDocumentRows: favoriteDocuments.map((document) => [
          document.title || "-",
          String(document.category || "-"),
          formatDate(document.createdAt, locale) || "-",
        ]),
        conversationRows: conversations.map((conversation) => [
          conversation.title || "-",
          String(conversation.messageCount ?? 0),
          formatDateTime(conversation.updatedAt, locale) || "-",
        ]),
        claimRows: claims.map((claim) => [
          claim.subject || "-",
          String(claim.status || "-"),
          formatDateTime(claim.updatedAt, locale) || "-",
        ]),
      });

      publishSnackbar({ variant: "success", message: t("profile.dataExported") });
    } catch {
      publishSnackbar({ variant: "error", message: t("profile.exportFailed") });
    } finally {
      setDownloadingData(false);
    }
  }

  async function onDisconnectAllDevices() {
    try {
      setDisconnectingDevices(true);
      await disconnectAllDevices();
      publishSnackbar({ variant: "success", message: t("profile.devicesDisconnected") });
      await logout();
    } catch {
      publishSnackbar({ variant: "error", message: t("profile.disconnectFailed") });
    } finally {
      setDisconnectingDevices(false);
    }
  }

  function openProfileModal() {
    setError(null);
    setIsProfileModalOpen(true);
  }

  function openPasswordModal() {
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  }

  if (!user || !form) {
    return <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 shadow-lg">{t("profile.loadingProfile")}</div>;
  }

  const effectivePasswordUpdatedAt = passwordUpdatedAtOverride ?? user.passwordUpdatedAt;
  const memberSinceLabel = formatDate(form.membreDepuis, locale);

  return (
    <>
      <div className="w-full space-y-4">
        <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(180deg,#2f3d59,#18233b)] text-4xl font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]">
                {avatarUrl && !avatarLoadFailed ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  initials
                )}
                <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-white bg-emerald-500 shadow-lg" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("claims.userArea")}</p>
                <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-slate-950">{fullName}</h1>
                <p className="mt-1 text-[13px] text-slate-500">{form.poste} ? {form.direction}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-700">{form.matricule}</span>
                  <span>{t("profile.memberSince")} {memberSinceLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <button type="button" onClick={openProfileModal} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-red-700">
                <Icon>
                  <path d="M4 20h4l10-10a2 2 0 1 0-4-4L4 16v4Z" />
                </Icon>
                {t("profile.edit")}
              </button>
              <button type="button" onClick={openPasswordModal} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-800 transition hover:border-red-200 hover:text-red-600">
                <Icon>
                  <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                  <path d="M19 10V8a7 7 0 1 0-14 0v2" />
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                </Icon>
                {t("profile.password")}
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_420px]">
          <div className="space-y-4">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg">
              <h2 className="text-[17px] font-semibold text-slate-950">{t("profile.personalInfo")}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoItem icon="mail" label={t("profile.email")} value={form.email} />
                <InfoItem icon="phone" label={t("profile.phone")} value={form.telephone} />
                <InfoItem icon="pin" label={t("profile.address")} value={form.adresse} />
                <InfoItem icon="calendar" label={t("profile.birthDate")} value={formatDate(form.dateNaissance, locale)} />
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg">
              <h2 className="text-[17px] font-semibold text-slate-950">{t("profile.professionalInfo")}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoItem icon="building" label={t("profile.department")} value={form.direction} />
                <InfoItem icon="briefcase" label={t("profile.role")} value={form.poste} />
                <InfoItem icon="pin" label={t("profile.office")} value={form.bureau} />
                <InfoItem icon="user" label={t("profile.manager")} value={form.responsable} />
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold text-slate-950">{t("profile.connectionsHistory")}</h2>
                <span className="text-[13px] text-slate-500">{user.loginHistory.length} {t("profile.latestConnections")}</span>
              </div>
              <div className="mt-4 space-y-3">
                {user.loginHistory.slice(-3).map((entry, index) => (
                  <SessionRow key={`${entry.device}-${entry.lastSeenAt}-${index}`} entry={entry} locale={locale} />
                ))}
              </div>
              <div className="mt-4 text-center text-[13px] font-medium text-slate-600">{t("profile.viewAllHistory")}</div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg">
              <h2 className="text-[17px] font-semibold text-slate-950">{t("profile.activity")}</h2>
              <div className="mt-4 space-y-3">
                <ActivityRow color="blue" label={t("profile.documents")} value={loadingActivity ? "..." : String(activity.documents)} />
                <ActivityRow color="green" label={t("profile.conversations")} value={loadingActivity ? "..." : String(activity.conversations)} />
                <ActivityRow color="orange" label={t("profile.claims")} value={loadingActivity ? "..." : String(activity.claims)} />
              </div>
            </section>

            <form onSubmit={onSubmitProfile} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold text-slate-950">{t("profile.preferences")}</h2>
                <button disabled={savingProfile || !isDirty} className="rounded-lg bg-red-600 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                  {savingProfile ? "..." : t("common.save")}
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <Field label={t("profile.language")}>
                  <select value={form.languePreferee} onChange={(e) => updateLanguageField(e.target.value as Language)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 outline-none transition focus:border-red-300">
                    <option value="fr">{t("profile.french")}</option>
                    <option value="en">{t("profile.english")}</option>
                    <option value="ar">{t("profile.arabic")}</option>
                  </select>
                </Field>
              
                <div className="border-t border-slate-100 pt-4">
                  <ToggleRow label={t("profile.emailNotifications")} helper={t("profile.importantUpdates")} checked={form.notificationsEmail} onChange={(value) => updateField("notificationsEmail", value)} />
                  <ToggleRow label={t("profile.smsNotifications")} helper={t("profile.urgentAlerts")} checked={form.notificationsSms} onChange={(value) => updateField("notificationsSms", value)} />
                </div>
                {error ? <div className="text-[12px] text-red-600">{error}</div> : null}
              </div>
            </form>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg">
              <h2 className="text-[17px] font-semibold text-slate-950">{t("profile.security")}</h2>
              <div className="mt-4 space-y-4">
                <ToggleRow label={t("profile.twoFactor")} helper={t("profile.strongProtection")} checked={form.twoFactorEnabled} onChange={(value) => updateField("twoFactorEnabled", value)} />
                <InfoStack label={t("profile.passwordUpdatedAt")} value={formatDate(effectivePasswordUpdatedAt, locale)} />
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-lg">
              <h2 className="text-[17px] font-semibold text-slate-950">{t("profile.quickActions")}</h2>
              <div className="mt-4 grid gap-2.5">
                <button type="button" onClick={onDownloadData} disabled={downloadingData} className="inline-flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60">
                  <Icon>
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                  </Icon>
                  {downloadingData ? "..." : t("profile.downloadData")}
                </button>
                <button type="button" onClick={openPasswordModal} className="inline-flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800 transition hover:border-red-200 hover:text-red-600">
                  <Icon>
                    <path d="M12 3 5 6v6c0 5 3.5 7.7 7 9 3.5-1.3 7-4 7-9V6l-7-3Z" />
                  </Icon>
                  {t("profile.securitySettings")}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <ModalShell open={isProfileModalOpen} title={t("profile.editTitle")} description={t("profile.editDescription")} onClose={() => setIsProfileModalOpen(false)}>
        <form onSubmit={onSubmitProfile} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Nom" value={form.nom} onChange={(value) => updateField("nom", value)} />
            <Input label="Prenom" value={form.prenom} onChange={(value) => updateField("prenom", value)} />
            <Input label={t("profile.email")} value={form.email} onChange={(value) => updateField("email", value)} />
            <Input label={t("profile.phone")} value={form.telephone} onChange={(value) => updateField("telephone", value)} />
            <Input label={t("profile.address")} value={form.adresse} onChange={(value) => updateField("adresse", value)} />
            <Input label={t("profile.birthDate")} value={form.dateNaissance} onChange={(value) => updateField("dateNaissance", value)} />
            <Input label={t("profile.department")} value={form.direction} onChange={(value) => updateField("direction", value)} />
            <Input label="Service" value={form.service} onChange={(value) => updateField("service", value)} />
            <Input label={t("profile.role")} value={form.poste} onChange={(value) => updateField("poste", value)} />
            <Input label="Matricule" value={form.matricule} onChange={(value) => updateField("matricule", value)} />
            <Input label={t("profile.office")} value={form.bureau} onChange={(value) => updateField("bureau", value)} />
            <Input label={t("profile.manager")} value={form.responsable} onChange={(value) => updateField("responsable", value)} />
          </div>
          <Input label={t("profile.memberSince")} value={form.membreDepuis} onChange={(value) => updateField("membreDepuis", value)} />
          {error ? <div className="text-[12px] text-red-600">{error}</div> : null}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setIsProfileModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300">
              {t("common.cancel")}
            </button>
            <button disabled={savingProfile || !isDirty} className="rounded-xl bg-red-600 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
              {savingProfile ? "..." : t("common.save")}
            </button>
          </div>
        </form>
      </ModalShell>

      <ModalShell open={isPasswordModalOpen} title={t("profile.passwordTitle")} description={t("profile.passwordDescription")} onClose={() => setIsPasswordModalOpen(false)}>
        <form onSubmit={onSubmitPassword} className="space-y-4">
          <div className="grid gap-4">
            <Input label={t("profile.currentPassword")} value={passwordForm.currentPassword} type="password" onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))} />
            <Input label={t("profile.newPassword")} value={passwordForm.newPassword} type="password" onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))} />
            <Input label={t("profile.confirmation")} value={passwordForm.confirmPassword} type="password" onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))} />
            {passwordError ? <div className="text-[12px] text-red-600">{passwordError}</div> : null}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300">
              {t("common.cancel")}
            </button>
            <button disabled={savingPassword} className="rounded-xl bg-red-600 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
              {savingPassword ? "..." : t("profile.update")}
            </button>
          </div>
        </form>
      </ModalShell>
    </>
  );
}

function ModalShell({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-[13px] text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700">
            {"Fermer"}
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-[13px] font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-[13px] font-medium text-slate-700">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-800 outline-none transition focus:border-red-300" />
    </label>
  );
}

function InfoItem({ icon, label, value }: { icon: "mail" | "phone" | "pin" | "calendar" | "building" | "briefcase" | "user"; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] text-slate-500">
        <span className="text-slate-400"><InfoGlyph icon={icon} /></span>
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-[14px] font-medium text-slate-900">{value}</div>
    </div>
  );
}

function InfoGlyph({ icon }: { icon: "mail" | "phone" | "pin" | "calendar" | "building" | "briefcase" | "user" }) {
  if (icon === "mail") return <Icon><path d="M4 6h16v12H4z" /><path d="m4 8 8 6 8-6" /></Icon>;
  if (icon === "phone") return <Icon><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8l-1.3 1.3a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 1.8-.6l3 .5A2 2 0 0 1 22 16.9Z" /></Icon>;
  if (icon === "pin") return <Icon><path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" /><circle cx="12" cy="11" r="2.5" /></Icon>;
  if (icon === "calendar") return <Icon><path d="M7 2v4" /><path d="M17 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></Icon>;
  if (icon === "building") return <Icon><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h.01" /><path d="M12 7h.01" /><path d="M16 7h.01" /><path d="M8 11h.01" /><path d="M12 11h.01" /><path d="M16 11h.01" /><path d="M10 21v-4h4v4" /></Icon>;
  if (icon === "briefcase") return <Icon><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Icon>;
  return <Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></Icon>;
}

function ActivityRow({ color, label, value }: { color: "blue" | "green" | "orange"; label: string; value: string }) {
  const accent = color === "blue" ? "bg-blue-50 text-blue-600" : color === "green" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600";
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
          <Icon>
            <rect x="6" y="4" width="12" height="16" rx="2" />
            <path d="M9 8h6" />
            <path d="M9 12h6" />
          </Icon>
        </div>
        <span className="text-[14px] text-slate-800">{label}</span>
      </div>
      <span className="text-[16px] font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function ToggleRow({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <div className="text-[14px] font-medium text-slate-900">{label}</div>
        <div className="text-[12px] text-slate-500">{helper}</div>
      </div>
      <button type="button" onClick={() => onChange(!checked)} className={`relative h-7 w-11 rounded-full transition ${checked ? "bg-slate-950" : "bg-slate-200"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? "left-5" : "left-1"}`} />
      </button>
    </div>
  );
}

function InfoStack({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div className="text-[13px] text-slate-500">{label}</div>
      <div className="mt-1.5 text-[14px] font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function StatusBadge({ tone }: { tone: "success" | "danger" }) {
  const classes = tone === "success" ? "text-emerald-500" : "text-red-500";

  return (
    <span className={`inline-flex items-center ${classes}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {tone === "success" ? <path d="m3.5 8 3 3 6-6" /> : <path d="M5 5l6 6M11 5l-6 6" />}
      </svg>
    </span>
  );
}

function SessionRow({ entry, locale }: { entry: LoginHistoryEntry; locale: string }) {
  const danger = entry.isSuspicious;
  return (
    <div className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${danger ? "border-red-100 bg-red-50/70" : "border-slate-100 bg-white"}`}>
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${danger ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>
          <Icon>
            <rect x="5" y="6" width="14" height="10" rx="2" />
            <path d="M8 20h8" />
          </Icon>
        </div>
        <div>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-950">
            <span>{entry.device}</span>
            {entry.isCurrent ? <StatusBadge tone="success" /> : null}
            {entry.isSuspicious ? <StatusBadge tone="danger" /> : null}
          </div>
          <div className="mt-1 text-[13px] text-slate-500">{entry.browser}:{entry.location}</div>
        </div>
      </div>
      <div className="text-right text-[13px] text-slate-500">{formatDateTime(entry.lastSeenAt, locale)}</div>
    </div>
  );
}




