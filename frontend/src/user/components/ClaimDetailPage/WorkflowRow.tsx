export default function WorkflowRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-2.5 text-[13px] ${active ? "border-slate-300 bg-slate-50 text-slate-900" : "border-slate-200 bg-white text-slate-400"}`}>
      <div className="font-semibold">{label}</div>
    </div>
  );
}
