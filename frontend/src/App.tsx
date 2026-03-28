import { RouterProvider } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { router } from "./router";
import { I18nProvider, useI18n } from "./i18n/I18nContext";

function SessionExpiredScreen() {
  const { sessionExpiredMessage, dismissSessionExpired } = useAuth();
  const { t } = useI18n();

  function handleReconnect() {
    dismissSessionExpired();
    window.location.assign("/login");
  }

  return (
    <div className="fixed inset-0 z-[200] flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,rgba(255,248,247,0.98)_0%,rgba(246,247,251,0.98)_100%)] px-6 py-8 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-[#ece9e7] bg-white px-8 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(218,61,32,0.10)] text-[#DA3D20]">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 8v4l2.5 2.5" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-[#0f172a]">{t("session.endedTitle")}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">{sessionExpiredMessage}</p>
        <button
          type="button"
          onClick={handleReconnect}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-[#DA3D20] px-6 text-sm font-semibold text-white transition hover:bg-[#C73519]"
        >
          {t("session.reconnect")}
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { sessionExpired } = useAuth();

  return (
    <>
      <RouterProvider router={router} />
      {sessionExpired ? <SessionExpiredScreen /> : null}
    </>
  );
}

function AppContent() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
