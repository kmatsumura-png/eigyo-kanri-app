// 画面の共通部品（カード・見出し・バッジなど）
import Link from "next/link";
import type { StageStatus, Tone } from "@/lib/insights";

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
    </div>
  );
}

export function Section({ title, desc, children, right }: { title: string; desc?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {desc && <p className="mt-0.5 text-xs text-ink-3">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function KpiCard({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className={`num mt-1 text-2xl font-bold tracking-tight sm:text-3xl ${tone === "bad" ? "text-bad" : ""}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<StageStatus, string> = {
  良好: "bg-[#e7f5e7] text-good",
  やや低い: "bg-[#fdf3e1] text-warn",
  課題: "bg-[#fbe9e9] text-bad",
  データ不足: "bg-bg text-ink-3",
};
const STATUS_ICON: Record<StageStatus, string> = { 良好: "◎", やや低い: "△", 課題: "✕", データ不足: "－" };

export function StatusBadge({ status }: { status: StageStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      <span aria-hidden>{STATUS_ICON[status]}</span>
      {status}
    </span>
  );
}

export function CommentList({ items }: { items: { tone: Tone; text: string }[] }) {
  if (!items.length) return <p className="text-sm text-ink-3">該当なし</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((c, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span
            aria-hidden
            className={`mt-0.5 shrink-0 font-bold ${c.tone === "good" ? "text-good" : c.tone === "bad" ? "text-bad" : "text-ink-3"}`}
          >
            {c.tone === "good" ? "▲" : c.tone === "bad" ? "▼" : "●"}
          </span>
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function NoData() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 text-sm leading-relaxed">
      <h1 className="mb-2 text-lg font-bold">まだデータが取り込まれていません</h1>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          <code>excel</code> フォルダに、営業管理システム・評価基準用数値集計（7〜9月）・トップチーム行動予定表の Excel を入れてください。
        </li>
        <li>
          黒い画面（ターミナル）で <code className="rounded bg-bg px-1">npm run import</code> を実行してください。
        </li>
        <li>この画面を再読み込みしてください。</li>
      </ol>
      <p className="mt-3 text-ink-2">
        詳しくは <code>README.md</code> を見てください。
      </p>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-accent hover:underline">
      {children}
    </Link>
  );
}
