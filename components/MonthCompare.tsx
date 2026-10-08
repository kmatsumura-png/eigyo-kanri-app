// 7月・8月・9月・3か月平均 を横に並べて比べる部品
import { MONTHS, monthLabel } from "@/lib/config";
import { fmtMan, fmtNum, fmtPct } from "@/lib/format";
import { monthlyAverage, statsFor, type Stats } from "@/lib/kpi";
import type { Dataset } from "@/lib/types";

type Item = { label: string; get: (s: Stats, isAvg: boolean) => string; trend?: (s: Stats) => number | null; strong?: boolean };

const BASIC: Item[] = [
  { label: "行動", get: (s, a) => `${fmtNum(s.actions, a ? 1 : 0)}件`, trend: (s) => s.actions },
  { label: "GET", get: (s, a) => `${fmtNum(s.gets, a ? 1 : 0)}件`, trend: (s) => s.gets, strong: true },
  { label: "契約率", get: (s) => fmtPct(s.contractRate), trend: (s) => s.contractRate, strong: true },
  { label: "ポイント", get: (s, a) => `${fmtNum(s.points, a || s.points % 1 ? 1 : 0)}pt`, trend: (s) => s.points },
];
const DETAIL: Item[] = [
  { label: "打電", get: (s, a) => (s.calls === null ? "—" : `${fmtNum(s.calls, a ? 1 : 0)}件`) },
  { label: "接触率", get: (s) => (s.contactRate === null ? "データなし" : fmtPct(s.contactRate)) },
  { label: "アポ", get: (s, a) => (s.appts === null ? "—" : `${fmtNum(s.appts, a ? 1 : 0)}件`), trend: (s) => s.appts },
  { label: "アポ率", get: (s) => fmtPct(s.apptRate, 2) },
  { label: "契約金額", get: (s) => fmtMan(s.amount) + (s.pendingCount ? ` (+要確認${fmtNum(s.pendingCount, s.pendingCount % 1 ? 1 : 0)})` : "") },
  { label: "平均単価", get: (s) => fmtMan(s.unitPrice) },
];

const MONEY = DETAIL.filter((d) => d.label === "契約金額" || d.label === "平均単価");

export default function MonthCompare({
  ds,
  memberIds,
  detailed = false,
  money = false,
}: {
  ds: Dataset;
  memberIds: string[];
  detailed?: boolean; // 打電・アポ・金額まで全部出す
  money?: boolean; // 契約金額・平均単価だけ追加
}) {
  const cols = [
    ...MONTHS.map((m, i) => ({ label: monthLabel(m), s: statsFor(ds, memberIds, [m]), prev: i > 0 ? statsFor(ds, memberIds, [MONTHS[i - 1]]) : null, avg: false })),
    { label: "3か月平均", s: monthlyAverage(statsFor(ds, memberIds, MONTHS)), prev: null, avg: true },
  ];
  const items = detailed ? [...BASIC, ...DETAIL] : money ? [...BASIC, ...MONEY] : BASIC;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cols.map((c) => (
        <div key={c.label} className={`rounded-lg p-3 ${c.avg ? "bg-ink text-white" : "bg-bg"}`}>
          <div className={`mb-2 text-sm font-bold ${c.avg ? "" : "text-ink"}`}>{c.label}</div>
          <dl className="space-y-1">
            {items.map((it) => {
              const cur = it.trend?.(c.s);
              const before = c.prev && it.trend ? it.trend(c.prev) : null;
              const arrow =
                cur === null || cur === undefined || before === null || before === undefined || cur === before ? "" : cur > before ? "▲" : "▼";
              return (
                <div key={it.label} className="flex items-baseline justify-between gap-2 text-sm">
                  <dt className={c.avg ? "text-white/70" : "text-ink-3"}>{it.label}</dt>
                  <dd className={`num text-right ${it.strong ? "font-bold" : ""}`}>
                    {it.get(c.s, c.avg)}
                    {arrow && <span className={`ml-1 text-[10px] ${arrow === "▲" ? "text-good" : "text-bad"}`}>{arrow}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
