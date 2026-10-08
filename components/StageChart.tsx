// 「アポ → 行動 → 成約 → 単価」のどこに課題があるかを並べる部品
import type { Diagnosis } from "@/lib/insights";
import { StatusBadge } from "./ui";

export default function StageChart({ d }: { d: Diagnosis }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {d.stages.map((s, i) => (
        <li
          key={s.key}
          className={`relative rounded-lg border p-3 ${d.main?.key === s.key ? "border-bad bg-[#fdf6f6]" : "border-line"}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs text-ink-3">
              {i + 1}. {s.label}
            </span>
            <StatusBadge status={s.status} />
          </div>
          <div className="mt-1.5 text-xs text-ink-2">{s.metric}</div>
          <div className="num text-lg font-bold">{s.value}</div>
          <div className="num text-xs text-ink-3">チーム平均 {s.team}</div>
          {s.ratio !== null && (
            <div className="mt-2 h-1.5 rounded-full bg-bg" aria-hidden>
              <div
                className={`h-1.5 rounded-full ${s.status === "良好" ? "bg-good" : s.status === "課題" ? "bg-bad" : "bg-warn"}`}
                style={{ width: `${Math.min(100, (s.ratio / 1.5) * 100)}%` }}
              />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
