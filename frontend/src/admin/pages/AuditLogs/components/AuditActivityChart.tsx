import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface AuditActivityChartProps {
  points: { label: string; value: number }[];
}

export function AuditActivityChart({ points }: AuditActivityChartProps) {
  const maxValue = Math.max(...points.map((point) => point.value), 0);
  const yAxisMax = maxValue <= 4 ? 4 : Math.ceil(maxValue * 1.15);

  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Activite (7 derniers jours)</h2>
        <p className="text-xs text-slate-500">Vue synthetique des volumes journaliers</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={true} />
            <XAxis
              dataKey="label"
              interval={0}
              tickMargin={8}
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={{ stroke: "#94a3b8" }}
              tickLine={{ stroke: "#94a3b8" }}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, yAxisMax]}
              tickCount={Math.min(yAxisMax + 1, 6)}
              tickMargin={6}
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={{ stroke: "#94a3b8" }}
              tickLine={{ stroke: "#94a3b8" }}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value} actions`, "Volume"]}
              labelFormatter={(label) => `Jour: ${label}`}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke="#b91c1c"
              strokeWidth={2.5}
              dot={{ r: 4.5, strokeWidth: 2, fill: "#b91c1c", stroke: "#b91c1c" }}
              activeDot={{ r: 5.5, strokeWidth: 2, fill: "#ffffff", stroke: "#b91c1c" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
