type ChartSegmentLike = {
  label: string;
  count: number;
  percentage: number;
  color: string;
};

export default function ChartLegendRow({ segment }: { segment: ChartSegmentLike }) {
  return (
    <div className="grid grid-cols-[14px_minmax(0,1fr)_64px_56px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: segment.color }} />
      <span className="font-semibold text-slate-800">{segment.label}</span>
      <span className="text-right">{segment.count}</span>
      <span className="text-right font-semibold text-slate-800">{segment.percentage.toFixed(1)}%</span>
    </div>
  );
}
