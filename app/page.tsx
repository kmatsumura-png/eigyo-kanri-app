// ① ダッシュボード：チーム全体の数字を見る画面
import Link from "next/link";
import { ActionVsGetChart, AmountChart, GetByMonthChart, RateByMonthChart } from "@/components/Charts";
import MonthCompare from "@/components/MonthCompare";
import Ranking from "@/components/Ranking";
import { CommentList, KpiCard, NoData, PageTitle, Section } from "@/components/ui";
import { MEMBERS, monthLabel } from "@/lib/config";
import { getData } from "@/lib/data";
import { fmtDiff, fmtMan, fmtNum, fmtPct } from "@/lib/format";
import { teamSummary } from "@/lib/insights";
import { ALL_IDS, contractsFor, monthlyAverage, parsePeriod, periodLabel, periodMonths, periodParam, prevMonth, productSummary, statsFor } from "@/lib/kpi";
import { getByMonthData, memberSeries, rankRows, rateByMonthData } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ds = getData();
  if (!ds) return <NoData />;
  const period = parsePeriod((await searchParams).period);
  const months = periodMonths(period);
  const pp = periodParam(period);
  const s = statsFor(ds, ALL_IDS, months);
  const avg = monthlyAverage(s);
  const prev = period !== "all" ? prevMonth(period) : null;
  const ps = prev ? statsFor(ds, ALL_IDS, [prev]) : null;
  const summary = teamSummary(ds, period);
  const products = productSummary(contractsFor(ds, ALL_IDS, months));
  const compareLabel = period === "all" ? "9月（8月と比べて）" : prev ? `${monthLabel(period)}（${monthLabel(prev)}と比べて）` : null;

  // カードの下に出す小さな補足
  const sub = (cur: number | null, before: number | null | undefined, unit: string, avgVal?: number | null, digits = 0) => {
    if (period === "all") return avgVal === undefined || avgVal === null ? null : `月平均 ${fmtNum(avgVal, 1)}${unit}`;
    if (cur === null || before === null || before === undefined) return null;
    return `前月比 ${fmtDiff(cur - before, unit, digits)}`;
  };

  return (
    <>
      <PageTitle title={`${periodLabel(period)} 営業チーム実績`} sub={`対象：${MEMBERS.map((m) => m.short).join("・")} の5人`} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="総アポ数" value={fmtNum(s.appts)} unit="件" sub={sub(s.appts, ps?.appts, "件", avg.appts)} />
        <KpiCard label="総商談数（＝行動数）" value={fmtNum(s.actions)} unit="件" sub={sub(s.actions, ps?.actions, "件", avg.actions)} />
        <KpiCard label="総契約数（＝GET数）" value={fmtNum(s.gets)} unit="件" sub={sub(s.gets, ps?.gets, "件", avg.gets)} />
        <KpiCard
          label="契約率"
          value={fmtPct(s.contractRate)}
          sub={
            period === "all"
              ? "3か月合計の GET ÷ 行動"
              : ps && ps.contractRate !== null && s.contractRate !== null
                ? `前月比 ${fmtDiff((s.contractRate - ps.contractRate) * 100, "%", 1)}`
                : null
          }
        />
        <KpiCard
          label="総契約金額"
          value={fmtMan(s.amount)}
          sub={
            <>
              金額確定 {s.amountCount}件
              {s.pendingCount > 0 && (
                <>
                  ・<Link href={`/deals?tab=contracts&status=pending&period=${pp}`} className="text-warn underline">要確認 {s.pendingCount}件</Link>
                </>
              )}
            </>
          }
        />
        <KpiCard label="平均単価" value={fmtMan(s.unitPrice)} sub="確定金額 ÷ 確定件数" />
        <KpiCard label="総ポイント" value={fmtNum(s.points, s.points % 1 ? 1 : 0)} unit="pt" sub={sub(s.points, ps?.points, "pt", avg.points)} />
        <KpiCard label="打電数 / アポ率" value={fmtNum(s.calls)} unit="件" sub={`アポ率（アポ÷打電） ${fmtPct(s.apptRate, 2)}`} />
      </div>

      <Section title="30秒でわかる今の状態" desc="すべて数字から自動で作ったコメントです">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1.5 text-sm font-bold text-good">▲ 調子がいい人 {compareLabel && <span className="font-normal text-ink-3">{compareLabel}</span>}</h3>
            <CommentList items={summary.hot} />
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-bold text-bad">▼ 落ちている人 {compareLabel && <span className="font-normal text-ink-3">{compareLabel}</span>}</h3>
            <CommentList items={summary.down} />
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-bold">誰に何を指導するか</h3>
            {summary.coaching.length ? (
              <ul className="space-y-1.5 text-sm">
                {summary.coaching.map((c) => (
                  <li key={c.memberId}>
                    <Link href={`/members/${c.memberId}?period=${pp}`} className="text-accent hover:underline">
                      {c.text}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">チーム平均を大きく下回る項目のある人はいません</p>
            )}
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-bold">チーム全体</h3>
            <CommentList items={summary.team} />
          </div>
        </div>
      </Section>

      <Section title="メンバーランキング" desc="名前をクリックすると個人ページに移動します">
        <Ranking rows={rankRows(ds, months)} periodParam={pp} />
      </Section>

      <Section title="チームの月別推移" desc="5人合計。▲▼は前月より上がった／下がった印。3か月平均の契約率は「合計GET ÷ 合計行動」です">
        <MonthCompare ds={ds} memberIds={ALL_IDS} money />
      </Section>

      <div className="grid gap-x-5 lg:grid-cols-2">
        <Section title="① 月別GET数" desc="7〜9月で、誰が何件GETしたか">
          <GetByMonthChart data={getByMonthData(ds)} series={memberSeries} />
        </Section>
        <Section title="② 月別契約率" desc="点線はチーム全体。上がっているか・下がっているか">
          <RateByMonthChart data={rateByMonthData(ds)} series={[...memberSeries, { key: "team", name: "チーム", color: "#16181d" }]} />
        </Section>
        <Section title={`③ 行動数とGET数（${periodLabel(period)}）`} desc="灰色の棒が高いのに青い棒が低い人は、商談後の成約に課題。上の数字は契約率">
          <ActionVsGetChart
            data={MEMBERS.map((m) => {
              const x = statsFor(ds, [m.id], months);
              return { name: m.short, actions: x.actions, gets: x.gets, rateLabel: fmtPct(x.contractRate) };
            })}
          />
        </Section>
        <Section title={`④ 契約金額（${periodLabel(period)}）`} desc="青＝金額が確定した契約／しま模様＝金額要確認（備考から読んだ候補金額）">
          <AmountChart
            data={MEMBERS.map((m) => {
              const x = statsFor(ds, [m.id], months);
              return { name: m.short, amount: x.amount, pending: x.pendingCandidate };
            })}
          />
        </Section>
      </div>

      <Section
        title="商品別契約数"
        desc="セット商品（例：ホームページ＋ブログ）は、それぞれの商品に1件ずつ数えています"
        right={<Link href={`/deals?tab=contracts&period=${pp}`} className="text-sm text-accent hover:underline">契約案件を見る →</Link>}
      >
        <ProductBars rows={products} />
      </Section>
    </>
  );
}

function ProductBars({ rows }: { rows: { category: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.category} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-2 text-sm sm:grid-cols-[13rem_1fr_3rem]">
          <span className="truncate text-ink-2">{r.category}</span>
          <span className="h-2.5 rounded-full bg-bg">
            <span className="block h-2.5 rounded-full bg-accent" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="num text-right font-semibold">{r.count}件</span>
        </li>
      ))}
    </ul>
  );
}
