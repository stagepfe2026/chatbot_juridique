interface AuditStatsProps {
  total: number;
  success: number;
  failed: number;
  critical: number;
}

const cards = [
  {
    key: "total",
    label: "Total des actions",
    tone: "border-slate-200 bg-white text-slate-900",
    accent: "bg-slate-900",
  },
  {
    key: "success",
    label: "Actions reussies",
    tone: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    accent: "bg-emerald-500",
  },
  {
    key: "failed",
    label: "Actions echouees",
    tone: "border-red-200 bg-red-50/80 text-red-900",
    accent: "bg-red-500",
  },
  {
    key: "critical",
    label: "Actions critiques",
    tone: "border-amber-200 bg-amber-50/90 text-amber-900",
    accent: "bg-amber-500",
  },
];

export function AuditStats({ total, success, failed, critical }: AuditStatsProps) {
  const values = { total, success, failed, critical };

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.key}
          className={`rounded-2xl border px-4 py-3 shadow-lg ${card.tone}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{card.label}</div>
              <div className="mt-2 text-2xl font-bold tracking-tight">{values[card.key as keyof typeof values]}</div>
            </div>
            <div className={`h-2.5 w-2.5 rounded-full ${card.accent}`} />
          </div>
        </article>
      ))}
    </section>
  );
}
