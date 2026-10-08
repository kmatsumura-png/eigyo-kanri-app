"use client";
// 画面上部：ページの切り替え・期間の切り替え・メンバーの切り替え
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MEMBERS, MONTHS, monthLabel } from "@/lib/config";

const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/members", label: "メンバー" },
  { href: "/deals", label: "案件一覧" },
  { href: "/analysis", label: "分析" },
  { href: "/data", label: "データ確認" },
];

const PERIODS = [...MONTHS.map((m) => ({ v: String(Number(m.slice(5, 7))), label: monthLabel(m) })), { v: "all", label: "7〜9月" }];

function chip(active: boolean) {
  return `shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${
    active ? "bg-ink text-white" : "bg-bg text-ink-2 hover:bg-line"
  }`;
}

export default function Header() {
  const pathname = usePathname();
  const params = useSearchParams();
  const period = params.get("period") ?? "all";
  const currentMember = pathname.startsWith("/members/") ? pathname.split("/")[2] : null;

  // 今のページのまま期間だけ変える
  const withPeriod = (v: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("period", v);
    return `${pathname}?${q.toString()}`;
  };
  const p = `?period=${period}`;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center gap-4 overflow-x-auto py-2.5">
          <Link href={`/${p}`} className="shrink-0 text-base font-bold tracking-tight">
            営業管理
          </Link>
          <nav className="flex gap-1">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={`${n.href}${p}`}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-accent/10 font-semibold text-accent" : "text-ink-2 hover:bg-bg"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col gap-2 pb-2.5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="mr-1 shrink-0 text-xs text-ink-3">期間</span>
            {PERIODS.map((x) => (
              <Link key={x.v} href={withPeriod(x.v)} className={chip(period === x.v)} scroll={false}>
                {x.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="mr-1 shrink-0 text-xs text-ink-3">表示</span>
            <Link href={`/${p}`} className={chip(!currentMember && pathname === "/")}>
              全員
            </Link>
            {MEMBERS.map((m) => (
              <Link key={m.id} href={`/members/${m.id}${p}`} className={chip(currentMember === m.id)}>
                {m.short}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
