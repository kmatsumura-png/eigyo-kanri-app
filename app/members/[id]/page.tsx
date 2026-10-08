// ③ 個人詳細：1人の営業実績・課題・商談・契約を見る画面
import { notFound } from "next/navigation";
import ContractTable from "@/components/ContractTable";
import MeetingList from "@/components/MeetingList";
import MonthCompare from "@/components/MonthCompare";
import StageChart from "@/components/StageChart";
import { CommentList, KpiCard, NoData, PageTitle, Section } from "@/components/ui";
import { MEMBERS, MONTHS } from "@/lib/config";
import { getData } from "@/lib/data";
import { fmtMan, fmtNum, fmtPct } from "@/lib/format";
import { diagnose, memberComments, strengthReport } from "@/lib/insights";
import { parsePeriod, periodLabel, periodMonths, productSummary, statsFor, teamPerPerson } from "@/lib/kpi";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const ds = getData();
  if (!ds) return <NoData />;
  const { id } = await params;
  const member = MEMBERS.find((m) => m.id === id);
  if (!member) notFound();
  const period = parsePeriod((await searchParams).period);
  const months = periodMonths(period);
  const s = statsFor(ds, [id], months);
  const t = teamPerPerson(ds, months);
  const d = diagnose(ds, id, months);
  const comments = memberComments(ds, id, period);
  const sw = strengthReport(ds, id, period);
  const meetings = ds.meetings.filter((m) => m.salesStaff === member.name);
  const contracts = ds.contracts.filter((c) => c.salesStaff === member.name && months.includes(c.month));
  const products = productSummary(contracts.filter((c) => c.kind === "契約"));
  const vs = (a: number | null, b: number | null, f: (v: number | null) => string) => `チーム平均 ${f(b)}${a !== null && b !== null ? (a >= b ? "（上回る）" : "（下回る）") : ""}`;

  return (
    <>
      <PageTitle title={member.name} sub={`${periodLabel(period)} の実績`} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="行動数（＝商談数）" value={fmtNum(s.actions)} unit="件" sub={vs(s.actions, t.actions, (v) => `${fmtNum(v, 1)}件`)} />
        <KpiCard label="GET数（＝契約数）" value={fmtNum(s.gets)} unit="件" sub={vs(s.gets, t.gets, (v) => `${fmtNum(v, 1)}件`)} />
        <KpiCard
          label="契約率"
          value={fmtPct(s.contractRate)}
          tone={s.contractRate !== null && t.contractRate !== null && s.contractRate < t.contractRate * 0.85 ? "bad" : undefined}
          sub={vs(s.contractRate, t.contractRate, (v) => fmtPct(v))}
        />
        <KpiCard label="契約金額" value={fmtMan(s.amount)} sub={`金額確定 ${s.amountCount}件${s.pendingCount ? `・要確認 ${s.pendingCount}件` : ""}`} />
        <KpiCard label="平均単価" value={fmtMan(s.unitPrice)} sub={s.amountCount < 2 ? `金額確定 ${s.amountCount}件のみのため参考値` : vs(s.unitPrice, t.unitPrice, fmtMan)} />
        <KpiCard label="ポイント" value={fmtNum(s.points, s.points % 1 ? 1 : 0)} unit="pt" sub={vs(s.points, t.points, (v) => `${fmtNum(v, 1)}pt`)} />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-2 text-base font-bold text-good">▲ この人の強み</h2>
          <BulletList items={sw.strengths} empty="チーム平均を上回っている項目はありません" tone="good" />
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-2 text-base font-bold text-bad">▼ 改善すべき点</h2>
          <BulletList items={sw.improvements} empty="チーム平均を大きく下回っている項目はありません" tone="bad" />
        </div>
      </div>
      <p className="-mt-3 mb-5 text-xs text-ink-3">比べている相手は5人のチーム平均です（{periodLabel(period)}）。前月比較は{period === "all" ? "9月と8月" : "前の月"}で見ています。</p>

      <Section title="課題（数字から見た改善ポイント）" desc={`${periodLabel(period)}の数字を、5人のチーム平均と比べています。左から順に、最初につまずいている所が一番の課題です。`}>
        <div className={`mb-4 rounded-lg p-4 ${d.main?.status === "課題" ? "bg-[#fdf6f6]" : "bg-bg"}`}>
          <p className="text-base font-bold">{d.headline}</p>
          <p className="mt-1 text-sm text-ink-2">{d.reason}</p>
          <p className="mt-2 text-sm">
            <span className="mr-1 font-semibold">改善の目安：</span>
            {d.advice}
          </p>
        </div>
        <StageChart d={d} />
      </Section>

      <Section title="数字の動き（自動コメント）" desc="期間が7〜9月のときは、最新の9月を8月と比べています">
        <CommentList items={comments} />
      </Section>

      <Section title="月別比較" desc="▲▼は前月より上がった／下がった印です。7・8月の接触数は元データにありません。">
        <MonthCompare ds={ds} memberIds={[id]} detailed />
      </Section>

      <Section title="商談一覧" desc="トップチーム行動予定表より（営業担当として入っている商談）。最初は最新月を表示しています。行をタップすると詳細が開きます。">
        <MeetingList key={period} meetings={meetings} initialMonth={period === "all" ? MONTHS[MONTHS.length - 1] : period} />
      </Section>

      <Section title={`契約案件（${periodLabel(period)}）`} desc="評価基準用数値集計の「案件一覧」より。契約金額は最終販売価格です。">
        {products.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {products.map((p) => (
              <span key={p.category} className="rounded-full bg-bg px-2.5 py-1 text-xs text-ink-2">
                {p.category} <b className="num text-ink">{p.count}件</b>
              </span>
            ))}
          </div>
        )}
        <ContractTable key={period} contracts={contracts} />
      </Section>
    </>
  );
}

function BulletList({ items, empty, tone }: { items: string[]; empty: string; tone: "good" | "bad" }) {
  if (!items.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-sm leading-relaxed">
          <span aria-hidden className={`mt-0.5 shrink-0 font-bold ${tone === "good" ? "text-good" : "text-bad"}`}>
            {tone === "good" ? "◎" : "!"}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
