"use client";
// 商談一覧（行動予定表の明細）。月で切り替えられます
import { useState } from "react";
import { MONTHS, monthLabel } from "@/lib/config";
import { fmtDate } from "@/lib/format";
import type { Meeting } from "@/lib/types";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function meetingStatus(m: Meeting): string {
  return m.result || m.done || (m.zenkakuResult === "前確NG" ? "前確NG" : "結果未入力");
}

function badge(status: string) {
  if (status === "GET") return "bg-[#e7f5e7] text-good";
  if (/日変|NG|飛ばし/.test(status)) return "bg-[#fbe9e9] text-bad";
  if (status === "結果未入力") return "bg-bg text-ink-3";
  return "bg-[#fdf3e1] text-warn";
}

export default function MeetingList({ meetings, initialMonth, showSales = false }: { meetings: Meeting[]; initialMonth: string; showSales?: boolean }) {
  const [month, setMonth] = useState(initialMonth);
  const [onlyGet, setOnlyGet] = useState(false);
  const list = meetings.filter((m) => (month === "all" || m.month === month) && (!onlyGet || m.result === "GET"));
  const getCount = list.filter((m) => m.result === "GET").length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {[...MONTHS, "all"].map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`rounded-md border px-3 py-1 text-sm ${month === m ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:bg-bg"}`}
          >
            {m === "all" ? "7〜9月" : monthLabel(m)}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-sm text-ink-2">
          <input type="checkbox" checked={onlyGet} onChange={(e) => setOnlyGet(e.target.checked)} />
          GETだけ
        </label>
        <span className="ml-auto text-xs text-ink-3">
          {list.length}件（うちGET {getCount}件）
        </span>
      </div>
      {list.length === 0 ? (
        <p className="py-4 text-sm text-ink-3">この期間の商談はありません</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((m) => {
            const st = meetingStatus(m);
            const d = new Date(m.date + "T00:00:00Z");
            return (
              <li key={m.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 hover:bg-bg">
                    <span className="num w-16 shrink-0 text-sm text-ink-2">
                      {fmtDate(m.date)}
                      <span className="text-xs text-ink-3">（{WEEK[d.getUTCDay()]}）</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{m.customerName || "（顧客名なし）"}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {[m.type, m.method, showSales && m.salesStaff ? `営業:${m.salesStaff}` : "", m.apoStaff ? `アポ:${m.apoStaff}` : ""].filter(Boolean).join("・")}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge(st)}`}>{st}</span>
                  </summary>
                  <dl className="mb-3 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 rounded-lg bg-bg p-3 text-xs sm:grid-cols-[6rem_1fr_6rem_1fr]">
                    {[
                      ["顧客ID", m.customerId],
                      ["アポ日", fmtDate(m.apoDate)],
                      ["商談日時", `${fmtDate(m.date)} ${m.time}`],
                      ["アポ担当", m.apoStaff],
                      ["営業担当", m.salesStaff],
                      ["前確結果", m.zenkakuResult],
                      ["アポ換算", m.apoKansan],
                      ["営業方法", m.method],
                      ["行動完了", m.done],
                      ["商談結果", m.result],
                      ["獲得P", m.points],
                      ["行動結果", m.actionResult],
                      ["訪問住所", m.address],
                      ["元データ", m.source],
                    ].map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-ink-3">{k}</dt>
                        <dd className="break-all">{v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
