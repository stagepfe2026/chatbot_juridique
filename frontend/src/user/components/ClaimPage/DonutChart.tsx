type ChartSegmentLike = {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
};

export default function DonutChart({ segments, total, totalLabel, claimsLabel }: { segments: ChartSegmentLike[]; total: number; totalLabel: string; claimsLabel: string }) {
  const size = 220;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-[220px] w-[220px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
        {segments.map((segment, index) => {
          const dash = total > 0 ? (segment.count / total) * circumference : 0;
          const dashOffset = segments.slice(0, index).reduce((sum, item) => sum + (total > 0 ? (item.count / total) * circumference : 0), 0);
          return <circle key={segment.status} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-dashOffset} />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{totalLabel}</div>
        <div className="mt-1 text-3xl font-semibold text-slate-900">{total}</div>
        <div className="mt-1 text-[12px] text-slate-500">{claimsLabel}</div>
      </div>
    </div>
  );
}
