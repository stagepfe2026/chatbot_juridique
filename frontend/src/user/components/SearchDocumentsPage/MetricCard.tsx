export default function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-[#efe5e1] bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
      {helper ? <div className="mt-1 text-[11px] text-slate-500">{helper}</div> : null}
    </div>
  );
}
