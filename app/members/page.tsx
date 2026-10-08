// ② メンバー一覧：5人の数字を月別に比較する画面
import Link from "next/link";
import MonthCompare from "@/components/MonthCompare";
import { NoData, PageTitle, Section, StatusBadge } from "@/components/ui";
import { MEMBERS, MEMBER_COLORS, MONTHS } from "@/lib/config";
import { getData } from "@/lib/data";
import { diagnose, strengthReport } from "@/lib/insights";
import { parsePeriod, periodParam } from "@/lib/kpi";

export const dynamic = "force-dynamic";

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ds = getData();
  if (!ds) return <NoData />;
  const pp = periodParam(parsePeriod((await searchParams).period));
  return (
    <>
      <PageTitle title="メンバー一覧（月別比較）" sub="7月・8月・9月と3か月平均を並べています。▲▼は前月より上がった／下がった印です。" />
      {MEMBERS.map((m) => {
        const d = diagnose(ds, m.id, MONTHS);
        const sw = strengthReport(ds, m.id, "all");
        return (
          <Section
            key={m.id}
            title={m.name}
            right={
              <Link href={`/members/${m.id}?period=${pp}`} className="text-sm text-accent hover:underline">
                個人ページへ →
              </Link>
            }
          >
            <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: MEMBER_COLORS[m.id] }} aria-hidden />
              <span className="text-ink-2">3か月の課題：</span>
              {d.main ? <StatusBadge status={d.main.status} /> : <StatusBadge status="良好" />}
              <span className="font-semibold">{d.headline}</span>
            </div>
            <div className="mb-3 grid gap-1 text-sm sm:grid-cols-2">
              <p>
                <span className="font-semibold text-good">強み：</span>
                {sw.strengths[0] ?? "—"}
              </p>
              <p>
                <span className="font-semibold text-bad">改善点：</span>
                {sw.improvements[0] ?? "—"}
              </p>
            </div>
            <MonthCompare ds={ds} memberIds={[m.id]} money />
          </Section>
        );
      })}
    </>
  );
}
