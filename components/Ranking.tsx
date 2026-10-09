"use client";
// メンバーランキング（契約数・契約率・契約金額・ポイントで切り替え）
import Link from "next/link";
import { useState } from "react";
import { fmtMan, fmtNum, fmtPct } from "@/lib/format";

export interface RankRow {
  id: string;
  name: string;
  actions: number;
  gets: number;
  rate: number | null;
  amount: number;
  unitPrice: number | null;
  points: number;
  pendingCount: number;
}

const TABS = [
  { key: "gets", label: "契約数" },
  { key: "rate", label: "契約率" },
  { key: "amount", label: "契約金額" },
  { key: "points", label: "ポイント" },
] as const;
type Key = (typeof TABS)[number]["key"];

export default function Ranking({ rows, periodParam }: { rows: RankRow[]; periodParam: string }) {
  const [key, setKey] = useState<Key>("gets");
  const sorted = [...rows].sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || b.gets - a.gets);
  const th = (k: Key | null, label: string, cls = "") => (
    <th className={`px-2 py-2 text-right font-medium ${k === key ? "text-ink" : "text-ink-3"} ${cls}`}>{label}</th>
  );
  const td = (k: Key | null, v: string, cls = "") => (
    <td className={`num px-2 py-2.5 text-right ${k === key ? "font-bold text-ink" : "text-ink-2"} ${cls}`}>{v}</td>
  );

  return (
    // data-snap-* は「閲覧用コピー」を作るときの目印（アプリの動きには影響しません）
    <div data-snap-root>
      <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            data-snap-btn={t.key}
            aria-selected={key === t.key}
            onClick={() => setKey(t.key)}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-sm ${
              key === t.key ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:bg-bg"
            }`}
          >
            {t.label}ランキング
          </button>
        ))}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-line text-xs">
            <tr>
              <th className="w-10 px-2 py-2 text-left font-medium text-ink-3">順位</th>
              <th className="px-2 py-2 text-left font-medium text-ink-3">名前</th>
              {th(null, "行動")}
              {th("gets", "GET")}
              {th("rate", "契約率")}
              {th("amount", "契約金額")}
              {th(null, "平均単価", "hidden sm:table-cell")}
              {th("points", "Pt")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-bg">
                <td className="px-2 py-2.5">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0 ? "bg-ink text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <Link href={`/members/${r.id}?period=${periodParam}`} className="font-semibold text-accent hover:underline">
                    {r.name}
                  </Link>
                </td>
                {td(null, fmtNum(r.actions))}
                {td("gets", fmtNum(r.gets))}
                {td("rate", fmtPct(r.rate))}
                {td("amount", fmtMan(r.amount) + (r.pendingCount ? " *" : ""))}
                {td(null, fmtMan(r.unitPrice), "hidden sm:table-cell")}
                {td("points", fmtNum(r.points, r.points % 1 ? 1 : 0))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        * 契約金額は「金額が確定した契約」だけの合計です。金額要確認の案件がある人には * が付いています。
      </p>
    </div>
  );
}
