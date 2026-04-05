import { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ConfirmDialog from '../../../components/ConfirmDialog';
import Snackbar from '../../../components/Snackbar';
import {
  deleteDocument,
  getAdminDocumentDownloadUrl,
  listDocuments,
  reindexDocument,
} from '../../../services/admin.service';
import type { Document, DocumentCategory, DocumentStatus } from '../../../models/document.models';

const PAGE_SIZE = 12;

const categoryLabel: Record<DocumentCategory, string> = {
  LOI_DES_FINANCES: 'Loi des finances',
  RECUEILS_DES_TEXTES_FISCAUX: 'Recueils des textes fiscaux',
  NOTE_COMMUNES: 'Notes communes',
  CONVENTIONS_DE_NON_DOUBLE_IMPOSITION: 'Convention NDI',
};

const statusLabel: Record<DocumentStatus, string> = {
  PROCESSING: 'En cours',
  INDEXED: 'Index�',
  FAILED: '�chou�',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatFileSize(value?: number | null): string {
  if (!value || value <= 0) return '-';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function formatFileType(value?: string | null): string {
  if (!value) return '-';
  return value
    .replace('application/', '')
    .replace('vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX')
    .replace('msword', 'DOC')
    .replace('pdf', 'PDF')
    .toUpperCase();
}

function getFilename(filePath: string): string {
  const parts = filePath.split(/[\\/]/g);
  return parts[parts.length - 1] || filePath;
}

function statusBadgeClasses(status: DocumentStatus): string {
  if (status === 'INDEXED') return 'bg-emerald-500 text-white';
  if (status === 'FAILED') return 'bg-red-500 text-white';
  return 'bg-amber-400 text-white';
}

function buildExportRows(items: Document[]) {
  return items.map((doc) => ({
    Titre: doc.title,
    Categorie: categoryLabel[doc.category] ?? doc.category,
    Statut: statusLabel[doc.documentStatus],
    'Date de realisation': formatDate(doc.realizedAt),
    'Date d\'indexation': formatDateTime(doc.indexedAt),
    Chunks: doc.chunksCount != null ? String(doc.chunksCount) : '-',
    Fichier: getFilename(doc.filePath),
  }));
}

function SectionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 text-[13px]">
      <div className="text-[#7b8798]">{label}</div>
      <div className="break-words text-right font-semibold text-[#334155]">{value}</div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M8.75 14.167a5.417 5.417 0 1 1 0-10.834 5.417 5.417 0 0 1 0 10.834Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.125 13.125 3.542 3.542" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[17px] w-[17px]" aria-hidden="true">
      <path d="M10 3.333v8.334" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6.667 8.75 3.333 3.333 3.333-3.333" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.167 13.75v.417a1.667 1.667 0 0 0 1.666 1.666h8.334a1.667 1.667 0 0 0 1.666-1.666v-.417" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[17px] w-[17px]" aria-hidden="true">
      <path d="M11.667 2.917H6.333a1.666 1.666 0 0 0-1.666 1.666v10.834a1.667 1.667 0 0 0 1.666 1.666h7.334a1.667 1.667 0 0 0 1.666-1.666V6.583l-3.666-3.666Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.667 2.917v3.666h3.666" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.917 10.417h4.166M7.917 13.333h4.166" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="m5.833 7.917 4.167 4.166 4.167-4.166" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DocumentsStatIcon({ tone, children }: { tone: 'purple' | 'green' | 'amber' | 'red'; children: React.ReactNode }) {
  const toneClasses = {
    purple: 'border-[#1e3a8a] text-[#1e3a8a]',
    green: 'border-[#34d399] text-[#34d399]',
    amber: 'border-[#f59e0b] text-[#f59e0b]',
    red: 'border-[#ef4444] text-[#ef4444]',
  };
  return <div className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] ${toneClasses[tone]}`}>{children}</div>;
}

export default function DocumentsListPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [confirmDoc, setConfirmDoc] = useState<Document | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [snack, setSnack] = useState<{
    open: boolean;
    message: string;
    variant: 'success' | 'error' | 'info';
  }>({ open: false, message: '', variant: 'info' });
  const menuRef = useRef<HTMLDivElement | null>(null);

  function showSnack(message: string, variant: 'success' | 'error' | 'info') {
    setSnack({ open: true, message, variant });
  }

  function resetFilters() {
    setQuery('');
    setStatus('');
    setCategory('');
    setPage(1);
  }

  async function refreshDocuments(nextSelectedId?: string | null) {
    const data = await listDocuments();
    setDocuments(data);
    if (nextSelectedId) {
      setSelectedDoc(data.find((doc) => doc.id === nextSelectedId) ?? null);
    }
  }

  function openOriginalDocument(doc: Document) {
    window.open(getAdminDocumentDownloadUrl(doc.id), '_blank', 'noopener,noreferrer');
  }

  async function handleReindex(doc: Document) {
    if (reindexingId === doc.id) return;
    try {
      setReindexingId(doc.id);
      setActionMenuId(null);
      const result = await reindexDocument(doc.id);
      await refreshDocuments(doc.id);
      showSnack(`R�indexation termin�e (${result.chunksCount} chunks).`, 'success');
    } catch (e: unknown) {
      const message =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message?: unknown }).message ?? 'Erreur de r�indexation.')
          : 'Erreur de r�indexation.';
      showSnack(message, 'error');
    } finally {
      setReindexingId(null);
    }
  }

  function handleExportExcel(items: Document[]) {
    if (items.length === 0) {
      showSnack('Aucun document à exporter.', 'info');
      return;
    }
    const rows = buildExportRows(items);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Documents');
    XLSX.writeFile(workbook, `documents_indexes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showSnack('Export Excel g�n�r� avec succ�s.', 'success');
  }

  function handleExportPdf(items: Document[]) {
    if (items.length === 0) {
      showSnack('Aucun document � exporter.', 'info');
      return;
    }
    const pdf = new jsPDF({ orientation: 'landscape' });
    pdf.setFontSize(14);
    pdf.text('Liste des documents indexes', 14, 16);
    pdf.setFontSize(10);
    pdf.text(`Filtres appliques: ${items.length} document(s)`, 14, 24);
    autoTable(pdf, {
      startY: 30,
      head: [['Document', 'Categorie', 'Statut', 'Realise', 'Indexe', 'Chunks']],
      body: items.map((doc) => [
        doc.title,
        categoryLabel[doc.category] ?? doc.category,
        statusLabel[doc.documentStatus],
        formatDate(doc.realizedAt),
        formatDateTime(doc.indexedAt),
        doc.chunksCount != null ? String(doc.chunksCount) : '-',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [122, 87, 209] },
    });
    pdf.save(`documents_indexes_${new Date().toISOString().slice(0, 10)}.pdf`);
    showSnack('Export PDF g�n�r� avec succ�s.', 'success');
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await listDocuments();
        if (!active) return;
        setDocuments(data);
      } catch (e: unknown) {
        if (!active) return;
        const message =
          typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message?: unknown }).message ?? 'Erreur de chargement.')
            : 'Erreur de chargement.';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const stats = useMemo(() => {
    const total = documents.length;
    const indexed = documents.filter((doc) => doc.documentStatus === 'INDEXED').length;
    const processing = documents.filter((doc) => doc.documentStatus === 'PROCESSING').length;
    const failed = documents.filter((doc) => doc.documentStatus === 'FAILED').length;
    return { total, indexed, processing, failed };
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (status && doc.documentStatus !== status) return false;
      if (category && doc.category !== category) return false;
      if (!q) return true;
      const blob = `${doc.title} ${doc.description || ''} ${getFilename(doc.filePath)}`.toLowerCase();
      return blob.includes(q);
    });
  }, [documents, query, status, category]);

  useEffect(() => {
    setPage(1);
  }, [query, status, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedDoc(null);
      return;
    }
    if (selectedDoc && !filtered.some((doc) => doc.id === selectedDoc.id)) {
      setSelectedDoc(null);
    }
  }, [filtered, selectedDoc]);

  const visibleStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const visibleEnd = filtered.length === 0 ? 0 : Math.min(safePage * PAGE_SIZE, filtered.length);

  async function confirmDelete() {
    if (!confirmDoc || deletingId) return;
    const doc = confirmDoc;
    try {
      setDeletingId(doc.id);
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setSelectedDoc((prev) => (prev?.id === doc.id ? null : prev));
      setActionMenuId(null);
      showSnack('Document supprim� d�finitivement.', 'success');
    } catch (e: unknown) {
      const message =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message?: unknown }).message ?? 'Erreur de suppression.')
          : 'Erreur de suppression.';
      showSnack(message, 'error');
    } finally {
      setDeletingId(null);
      setConfirmDoc(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <section className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-red-800">Documents indexes</h1>
          </div>
          <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => handleExportExcel(filtered)} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[#dfe5ee] bg-[#fbfcfe] px-4 text-[12px] font-semibold text-[#3b4758] transition hover:bg-white">
                <DownloadIcon />
                <span>Export Excel</span>
              </button>
              <button type="button" onClick={() => handleExportPdf(filtered)} className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-[#dfe5ee] bg-[#fbfcfe] px-4 text-[12px] font-semibold text-[#3b4758] transition hover:bg-white">
                <FileIcon />
                <span>PDF</span>
              </button>
            </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[14px] border border-[#e6eaf1] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[#9aa5b5]">Total</div>
              <div className="mt-2 text-[18px] font-semibold text-[#1f2937]">{stats.total}</div>
            </div>
            <DocumentsStatIcon tone="purple">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M13.5 6.75H10a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V10l-2.5-3.25Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.5 6.75V10H16M10.8 12.2h3.4M10.8 14.7h3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </DocumentsStatIcon>
          </div>
        </div>
        <div className="rounded-[14px] border border-[#e6eaf1] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[#9aa5b5]">Indexés</div>
              <div className="mt-2 text-[18px] font-semibold text-[#1f2937]">{stats.indexed}</div>
            </div>
            <DocumentsStatIcon tone="green">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="m8.7 12.2 2.1 2.1 4.5-4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </DocumentsStatIcon>
          </div>
        </div>
        <div className="rounded-[14px] border border-[#e6eaf1] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[#9aa5b5]">En cours</div>
              <div className="mt-2 text-[18px] font-semibold text-[#1f2937]">{stats.processing}</div>
            </div>
            <DocumentsStatIcon tone="amber">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 8v4.2l3 1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </DocumentsStatIcon>
          </div>
        </div>
        <div className="rounded-[14px] border border-[#e6eaf1] bg-white px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[#9aa5b5]">Echoues</div>
              <div className="mt-2 text-[18px] font-semibold text-[#1f2937]">{stats.failed}</div>
            </div>
            <DocumentsStatIcon tone="red">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 8.2v4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="16.3" r="1" fill="currentColor" />
              </svg>
            </DocumentsStatIcon>
          </div>
        </div>
        </div>

        <div className='w-full'>
          <div className="space-y-4">
            <div className="rounded-[14px] border border-[#e6eaf1] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] shadow-lg">
             <div className="border-b border-[#edf1f6] px-7 py-[18px]">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px_198px_118px]">
              <label className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98a3b3]">
                  <SearchIcon />
                </span>
                <input className="h-[40px] w-full rounded-[9px] border border-[#dfe5ee] bg-white pl-11 pr-4 text-[13px] text-[#425063] outline-none transition placeholder:text-[#a0aabc] focus:border-red-600 focus:ring-2 focus:ring-[#ffe6de]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." />
              </label>
              <div className="relative">
                <select className="h-[40px] w-full appearance-none rounded-[9px] border border-[#dfe5ee] bg-white px-4 pr-10 text-[12px] font-semibold text-[#425063] outline-none focus:border-red-600 focus:ring-2 focus:ring-[#ffe6de]" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory | '')}>
                  <option value="">Toutes catégories</option>
                  {Object.entries(categoryLabel).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#b0b8c5]">
                  <ChevronDownIcon />
                </span>
              </div>
              <div className="relative">
                <select className="h-[40px] w-full appearance-none rounded-[9px] border border-[#dfe5ee] bg-white px-4 pr-10 text-[12px] font-semibold text-[#425063] outline-none focus:border-red-600 focus:ring-2 focus:ring-[#ffe6de]" value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus | '')}>
                  <option value="">Tous statuts</option>
                  <option value="PROCESSING">En cours</option>
                  <option value="INDEXED">Indexé</option>
                  <option value="FAILED">Échoué</option>
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#b0b8c5]">
                  <ChevronDownIcon />
                </span>
              </div>
              <button type="button" onClick={resetFilters} className="h-[40px] rounded-[9px] border border-[#dfe5ee] bg-[#f8fafc] px-4 text-[12px] font-semibold text-[#425063] transition hover:border-red-600 hover:bg-[#fff5f2] hover:text-red-700">R�initialiser</button>
            </div>
            <div className="mt-4 text-[13px] text-[#7f8b9d]">{filtered.length} documents à Affichage {visibleStart}-{visibleEnd}</div>
            </div>


          {loading && <div className="px-7 py-7 text-[14px] text-[#7a8699]">Chargement des documents...</div>}
          {error && <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
          {!loading && !error && filtered.length === 0 && <div className="px-7 py-8 text-center text-[14px] text-[#7a8699]">Aucun document � afficher.</div>}

          {!loading && !error && filtered.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full border-separate border-spacing-0 ">
                  <thead>
                    <tr className="bg-[#fbfcff]">
                      <th className="border-b border-[#edf1f6] px-7 py-4 text-left text-[12px] font-semibold uppercase tracking-[0.03em] text-[#7c8798]">Titre</th>
                      <th className="border-b border-[#edf1f6] px-4 py-4 text-left text-[12px] font-semibold uppercase tracking-[0.03em] text-[#7c8798]">Catégorie</th>
                      <th className="border-b border-[#edf1f6] px-4 py-4 text-left text-[12px] font-semibold uppercase tracking-[0.03em] text-[#7c8798]">Statut</th>
                      <th className="border-b border-[#edf1f6] px-4 py-4 text-left text-[12px] font-semibold uppercase tracking-[0.03em] text-[#7c8798]">Réalisé</th>
                      <th className="border-b border-[#edf1f6] px-4 py-4 text-left text-[12px] font-semibold uppercase tracking-[0.03em] text-[#7c8798]">Indexé</th>
                      <th className="border-b border-[#edf1f6] px-7 py-4 text-left text-[12px] font-semibold uppercase tracking-[0.03em] text-[#7c8798]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((doc) => {
                      const isSelected = selectedDoc?.id === doc.id;
                      const isReindexing = reindexingId === doc.id;
                      const isDeleting = deletingId === doc.id;
                      const isMenuOpen = actionMenuId === doc.id;

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => {
                            setSelectedDoc(doc);
                            setActionMenuId(null);
                          }}
                          className={`${isSelected ? 'bg-[#fdf1ed]' : 'bg-white hover:bg-[#fcfdff]'} cursor-pointer transition-colors`}
                        >
                          <td className="border-b border-[#edf1f6] px-7 py-5 text-[14px] font-semibold text-[#334155]">
                            <div className="max-w-[280px] truncate">{doc.title}</div>
                          </td>
                          <td className="border-b border-[#edf1f6] px-4 py-5 text-[14px] text-[#7a8798]">{categoryLabel[doc.category] ?? doc.category}</td>
                          <td className="border-b border-[#edf1f6] px-4 py-5"><span className={`inline-flex rounded-[8px] px-2.5 py-1 text-[11px] font-semibold leading-none ${statusBadgeClasses(doc.documentStatus)}`}>{statusLabel[doc.documentStatus]}</span></td>
                          <td className="border-b border-[#edf1f6] px-4 py-5 text-[14px] text-[#7a8798]">{formatDate(doc.realizedAt)}</td>
                          <td className="border-b border-[#edf1f6] px-4 py-5 text-[14px] text-[#7a8798]">{doc.indexedAt ? formatDateTime(doc.indexedAt) : '-'}</td>
                          <td className="relative border-b border-[#edf1f6] px-7 py-5 text-left">
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe5ee] bg-white text-[#64748b] shadow-sm transition hover:border-[#d6dde8] hover:bg-[#f8fafc] hover:text-[#334155]"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActionMenuId((prev) => (prev === doc.id ? null : doc.id));
                              }}
                              aria-label="Ouvrir les actions"
                            >
                              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                <circle cx="4" cy="10" r="1.4" />
                                <circle cx="10" cy="10" r="1.4" />
                                <circle cx="16" cy="10" r="1.4" />
                              </svg>
                            </button>
                            {isMenuOpen ? (
                              <div
                                ref={menuRef}
                                className="absolute left-4 top-[60px] z-20 w-52 rounded-2xl bg-white p-1 shadow-[0_20px_44px_rgba(15,23,42,0.14)]"
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-xl border border-[#2f3a4a] bg-white pl-2.5 pr-1.5 py-2 text-left text-[11px] font-medium text-[#2f3a4a] transition hover:bg-slate-50"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openOriginalDocument(doc);
                                    setActionMenuId(null);
                                  }}
                                >
                                  <svg viewBox="0 0 20 20" className="h-3 w-3 text-[#64748b]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                    <path d="M2.5 10s2.7-4.167 7.5-4.167S17.5 10 17.5 10s-2.7 4.167-7.5 4.167S2.5 10 2.5 10Z" />
                                    <circle cx="10" cy="10" r="2.2" />
                                  </svg>
                                  <span>Voir original</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-xl border border-[#2f3a4a] bg-white pl-2.5 pr-1.5 py-2 text-left text-[11px] font-medium text-[#2f3a4a] transition hover:bg-slate-50 disabled:opacity-60"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleReindex(doc);
                                  }}
                                  disabled={isReindexing}
                                >
                                  <svg viewBox="0 0 20 20" className="h-3 w-3 text-[#64748b]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                    <path d="M16.667 10A6.667 6.667 0 1 1 14.714 5.286" />
                                    <path d="M16.667 3.333v4.286H12.38" />
                                  </svg>
                                  <span>{isReindexing ? "Reindexation..." : "Reindexer"}</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-xl border border-[#2f3a4a] bg-white pl-2.5 pr-1.5 py-2 text-left text-[11px] font-medium text-[#ff3b30] transition hover:bg-red-50 disabled:opacity-60"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setConfirmDoc(doc);
                                    setActionMenuId(null);
                                  }}
                                  disabled={isDeleting}
                                >
                                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                    <path d="M4.167 5h11.666" />
                                    <path d="M7.5 5V3.75h5V5" />
                                    <path d="M6.667 7.5v7.083" />
                                    <path d="M10 7.5v7.083" />
                                    <path d="M13.333 7.5v7.083" />
                                    <path d="M5.833 5 6.25 16.25a.833.833 0 0 0 .833.802h5.834a.833.833 0 0 0 .833-.802L14.167 5" />
                                  </svg>
                                  <span>Supprimer</span>
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-[#edf1f6] px-7 py-4">
                  <button type="button" className="h-[38px] min-w-[108px] rounded-[9px] border border-[#dfe5ee] bg-[#f8fafc] px-4 text-[12px] font-semibold text-[#6b7788] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setPage((prev) => Math.max(prev - 1, 1))} disabled={safePage === 1}>Pr�c�dent</button>
                  <div className="text-[13px] font-medium text-[#7f8b9d]">Page {safePage} sur {totalPages}</div>
                  <button type="button" className="h-[38px] min-w-[108px] rounded-[9px] border border-[#dfe5ee] bg-[#f8fafc] px-4 text-[12px] font-semibold text-[#6b7788] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))} disabled={safePage === totalPages}>Suivant</button>
                </div>
              ) : null}
            </>
          )}
            </div>
          </div>

        {selectedDoc ? (
          <>
            <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setSelectedDoc(null)} aria-hidden="true" />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[40rem] flex-col border-l border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
              <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-600">Inspection</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Detail document</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  className="rounded-xl border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Fermer le panneau"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-base font-semibold text-slate-950">{selectedDoc.title}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-[8px] px-2.5 py-1 text-[11px] font-semibold leading-none ${statusBadgeClasses(selectedDoc.documentStatus)}`}>{statusLabel[selectedDoc.documentStatus]}</span>
                    <span className="inline-flex rounded-[8px] bg-[#eef4ff] px-2.5 py-1 text-[11px] font-medium text-[#1e3a8a]">{categoryLabel[selectedDoc.category] ?? selectedDoc.category}</span>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <h3 className="text-[12px] font-semibold text-slate-900">Resume</h3>
                  <p className="mt-2 text-[13px] leading-5 text-slate-700">{selectedDoc.description?.trim() || 'Aucune description disponible pour ce document.'}</p>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <h3 className="text-[12px] font-semibold text-slate-900">Informations du fichier</h3>
                  <div className="mt-2 space-y-0.5">
                    <SectionRow label="Fichier:" value={getFilename(selectedDoc.filePath)} />
                    <SectionRow label="Type:" value={formatFileType(selectedDoc.fileType)} />
                    <SectionRow label="Taille:" value={formatFileSize(selectedDoc.fileSize)} />
                    <SectionRow label="Chunks indexes:" value={selectedDoc.chunksCount != null ? String(selectedDoc.chunksCount) : '-'} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <h3 className="text-[12px] font-semibold text-slate-900">Dates et tracabilite</h3>
                  <div className="mt-2 space-y-0.5">
                    <SectionRow label="Date realisation:" value={formatDate(selectedDoc.realizedAt)} />
                    <SectionRow label="Date indexation:" value={formatDateTime(selectedDoc.indexedAt)} />
                    <SectionRow label="Source:" value={selectedDoc.filePath || '-'} />
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <h3 className="text-[12px] font-semibold text-slate-900">Actions</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button type="button" className="inline-flex h-[38px] items-center justify-center rounded-[10px] border border-[#dfe5ee] bg-white px-2 text-center text-[12px] font-semibold text-[#425063] transition hover:bg-slate-50" onClick={() => openOriginalDocument(selectedDoc)}>Voir original</button>
                    <button type="button" className="inline-flex h-[38px] items-center justify-center rounded-[10px] border border-[#dfe5ee] bg-white px-2 text-center text-[12px] font-semibold text-[#425063] transition hover:bg-slate-50 disabled:opacity-60" onClick={() => void handleReindex(selectedDoc)} disabled={reindexingId === selectedDoc.id}>{reindexingId === selectedDoc.id ? 'Reindexation...' : 'Reindexer'}</button>
                    <button type="button" className="inline-flex h-[38px] items-center justify-center rounded-[10px] border border-red-200 bg-white px-2 text-center text-[12px] font-semibold text-[#ef4444] transition hover:bg-red-50 disabled:opacity-60" onClick={() => setConfirmDoc(selectedDoc)} disabled={deletingId === selectedDoc.id}>Supprimer</button>
                  </div>
                </section>
              </div>
            </aside>
          </>
        ) : null}

        <ConfirmDialog
          open={!!confirmDoc}
          title="Suppression définitive"
          message={confirmDoc ? `Supprimer définitivement "${confirmDoc.title}" ? Cette action supprime le document de MongoDB et de Qdrant.` : ''}
          confirmText={deletingId ? 'Suppression...' : 'Supprimer'}
          cancelText="Annuler"
          onCancel={() => setConfirmDoc(null)}
          onConfirm={() => void confirmDelete()}
        />

          <Snackbar
            open={snack.open}
            message={snack.message}
            variant={snack.variant}
            onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          />
        </div>
      </div>
    </>
  );
}


























