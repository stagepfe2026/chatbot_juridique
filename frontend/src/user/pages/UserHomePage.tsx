import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nContext";

const labels = {
  fr: {
    badge: "Assistant Juridique",
    title: "Bienvenue dans votre espace documentaire",
    subtitle: "Accedez au chatbot RAG ou lancez une recherche rapide dans vos documents.",
    openChatbot: "Ouvrir le chatbot",
    searchDocument: "Rechercher un document",
    seeFavorites: "Voir mes favoris",
    smartSearch: "Recherche intelligente",
    smartSearchText: "Trouvez un document par titre ou contenu.",
    guidedConsultations: "Consultations guidees",
    guidedConsultationsText: "Posez vos questions juridiques en direct.",
    legalChatbot: "Chatbot juridique",
    legalChatbotText: "Interrogez vos documents avec l'IA.",
    docSearch: "Recherche documentaire",
    docSearchText: "Filtrez, explorez et favorisez vos sources.",
    favoriteDocs: "Documents favoris",
    favoriteDocsText: "Accedez aux documents que vous avez favorises.",
  },
  en: {
    badge: "Legal Assistant",
    title: "Welcome to your document workspace",
    subtitle: "Access the RAG chatbot or launch a quick search through your documents.",
    openChatbot: "Open chatbot",
    searchDocument: "Search a document",
    seeFavorites: "View my favorites",
    smartSearch: "Smart search",
    smartSearchText: "Find a document by title or content.",
    guidedConsultations: "Guided consultations",
    guidedConsultationsText: "Ask your legal questions live.",
    legalChatbot: "Legal chatbot",
    legalChatbotText: "Query your documents with AI.",
    docSearch: "Document search",
    docSearchText: "Filter, explore, and favorite your sources.",
    favoriteDocs: "Favorite documents",
    favoriteDocsText: "Access the documents you marked as favorite.",
  },
  ar: {
    badge: "المساعد القانوني",
    title: "مرحباً بكم في فضائكم الوثائقي",
    subtitle: "يمكنكم الولوج إلى الشات بوت أو إطلاق بحث سريع داخل وثائقكم.",
    openChatbot: "فتح الشات بوت",
    searchDocument: "البحث عن وثيقة",
    seeFavorites: "عرض المفضلة",
    smartSearch: "بحث ذكي",
    smartSearchText: "اعثر على وثيقة حسب العنوان أو المحتوى.",
    guidedConsultations: "استشارات موجهة",
    guidedConsultationsText: "اطرح أسئلتك القانونية مباشرة.",
    legalChatbot: "الشات بوت القانوني",
    legalChatbotText: "استفسر عن وثائقك بالذكاء الاصطناعي.",
    docSearch: "البحث الوثائقي",
    docSearchText: "رشح واستكشف وضع المصادر في المفضلة.",
    favoriteDocs: "الوثائق المفضلة",
    favoriteDocsText: "الوصول إلى الوثائق التي قمت بتفضيلها.",
  },
} as const;

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{children}</svg>;
}

function ActionCard({ to, title, text, children }: { to: string; title: string; text: string; children: ReactNode }) {
  return (
    <Link to={to} className="group flex items-start gap-3 rounded-xl border border-white/60 bg-white/80 p-4 no-underline shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:shadow-[0_12px_30px_rgba(239,68,68,0.1)]">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition group-hover:bg-red-100">{children}</div>
      <div><div className="text-base font-bold text-slate-900">{title}</div><div className="mt-0.5 text-xs text-slate-500">{text}</div></div>
    </Link>
  );
}

export default function UserHomePage() {
  const { language } = useI18n();
  const l = labels[language];

  return (
    <div className="grid gap-5 p-4">
      <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-xl border border-white/60 bg-gradient-to-br from-white to-red-50/30 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">{l.badge}</span>
          <h1 className="mt-4 max-w-xl text-2xl font-bold leading-snug text-slate-900">{l.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">{l.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to="/user/chat" className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white no-underline shadow-lg transition hover:-translate-y-px">{l.openChatbot}</Link>
            <Link to="/user/recherche" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 no-underline transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">{l.searchDocument}</Link>
            <Link to="/user/favoris" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 no-underline transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">{l.seeFavorites}</Link>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/60 bg-white/80 p-4 shadow-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><Icon><path d="M4 6h16v12H4z" /><path d="M8 10h8" /></Icon></div>
            <div><div className="text-sm font-bold text-slate-900">{l.smartSearch}</div><div className="mt-0.5 text-xs text-slate-500">{l.smartSearchText}</div></div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/60 bg-white/80 p-4 shadow-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><Icon><path d="M12 5v14" /><path d="M5 12h14" /></Icon></div>
            <div><div className="text-sm font-bold text-slate-900">{l.guidedConsultations}</div><div className="mt-0.5 text-xs text-slate-500">{l.guidedConsultationsText}</div></div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ActionCard to="/user/chat" title={l.legalChatbot} text={l.legalChatbotText}><Icon><path d="M8 3h6l4 4v14H6V3z" /><path d="M14 3v4h4" /></Icon></ActionCard>
        <ActionCard to="/user/recherche" title={l.docSearch} text={l.docSearchText}><Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" /></Icon></ActionCard>
        <ActionCard to="/user/favoris" title={l.favoriteDocs} text={l.favoriteDocsText}><Icon><path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3z" /></Icon></ActionCard>
      </section>
    </div>
  );
}
