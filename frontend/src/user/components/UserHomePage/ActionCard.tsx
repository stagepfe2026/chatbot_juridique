import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function ActionCard({
  to,
  title,
  text,
  children,
}: {
  to: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-white/60 bg-white/80 p-4 no-underline shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:shadow-[0_12px_30px_rgba(239,68,68,0.1)]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition group-hover:bg-red-100">
        {children}
      </div>
      <div>
        <div className="text-base font-bold text-slate-900">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{text}</div>
      </div>
    </Link>
  );
}
