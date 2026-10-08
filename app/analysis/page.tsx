// ⑤ 分析：「誰のどこに課題があるか」を見る画面
import Link from "next/link";
import { NoData, PageTitle, Section, StatusBadge } from "@/components/ui";
import { MEMBERS } from "@/lib/config";
import { getData } from "@/lib/data";
import { fmtNum, fmtPct } from "@/lib/format";
import { diagnose } from "@/lib/insights";
import { parsePeriod, periodLabel, periodMonths, periodParam, statsFor, teamPerPerson } from "@/lib/kpi";

export const dynamic = "force-dynamic";

const FLOW = [
  { step: "アポ数が少ない", then: "アポ獲得に課題" },
  { step: "アポはある → 行動数が少ない", then: "行動量に課題" },
  { step: "行動は多い → GETが少ない", then: "商談後の成約率に課題" },
  { step: "GETは多い → 契約金額が低い", then: "平均単価に課題" },
];

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ds = getData();
  if (!ds) return <NoData />;
  const period = parsePeriod((await searchParams).period);
  const months = periodMonths(period);
  const pp = periodParam(period);
  const t = teamPerPerson(ds, months);
  const rows = MEMBERS.map((m) => ({ m, d: diagnose(ds, m.id, months), s: statsFor(ds, [m.id], months) }));
  // チーム平均の契約率で成約できた場合に増えるGET数（伸びしろ）
  const upside = rows
    .map((r) => ({ ...r, gain: r.s.actions * (t.contractRate ?? 0) - r.s.gets }))
    .sort((a, b) => b.gain - a.gain);

  return (
    <>
      <PageTitle title="分析：どこを改善すれば数字が伸びるか" sub={`${periodLabel(period)}・チーム平均（5人）との比較`} />

      <Section title="判定のしかた" desc="営業の流れを左から順に見て、最初にチーム平均を大きく下回っている所を「一番の課題」としています">
        <ol className="grid gap-2 sm:grid-cols-4">
          {FLOW.map((f, i) => (
            <li key={f.step} className="rounded-lg bg-bg p-3 text-sm">
              <div className="text-xs text-ink-3">{i + 1}</div>
              <div>{f.step}</div>
              <div className="mt-1 font-bold">→ {f.then}</div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-ink-3">
          ◎良好＝チーム平均以上／△やや低い＝平均の85〜100%／✕課題＝平均の85%未満。アポ数は本人が獲得したアポの数です。
        </p>
      </Section>

      <Section title="課題マップ" desc="名前をクリックすると個人ページで詳しく見られます">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-xs text-ink-3">
              <tr>
                <th className="px-2 py-2 text-left font-medium">名前</th>
                {rows[0].d.stages.map((s) => (
                  <th key={s.key} className="px-2 py-2 text-left font-medium">
                    {s.label}
                    <span className="block font-normal">{s.metric}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-medium">一番の課題</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, d }) => (
                <tr key={m.id} className="border-b border-line align-top last:border-0">
                  <td className="px-2 py-3 font-semibold">
                    <Link href={`/members/${m.id}?period=${pp}`} className="text-accent hover:underline">
                      {m.short}
                    </Link>
                  </td>
                  {d.stages.map((s) => (
                    <td key={s.key} className={`px-2 py-3 ${d.main?.key === s.key ? "bg-[#fdf6f6]" : ""}`}>
                      <StatusBadge status={s.status} />
                      <div className="num mt-1 text-xs text-ink-2">{s.value}</div>
                    </td>
                  ))}
                  <td className="px-2 py-3 text-xs font-semibold">{d.headline}</td>
                </tr>
              ))}
              <tr className="text-xs text-ink-3">
                <td className="px-2 py-2">チーム平均</td>
                {rows[0].d.stages.map((s) => (
                  <td key={s.key} className="num px-2 py-2">
                    {s.team}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="成約率の伸びしろ" desc={`今の行動数のまま、チーム平均の契約率（${fmtPct(t.contractRate)}）で成約できたら何件増えるか`}>
        <ul className="space-y-2">
          {upside.map(({ m, s, gain }) => (
            <li key={m.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="font-semibold">{m.short}</span>
              <span className="text-xs text-ink-2">
                行動{fmtNum(s.actions)}件・GET{fmtNum(s.gets)}件・契約率 {fmtPct(s.contractRate)}
              </span>
              <span className={`num text-right font-bold ${gain > 0.05 ? "text-bad" : "text-good"}`}>
                {gain > 0.05 ? `+${fmtNum(gain, 1)}件` : "平均以上"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="一人ひとりの課題と改善の目安">
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(({ m, d }) => (
            <div key={m.id} className="rounded-lg border border-line p-4">
              <div className="mb-1 flex items-center gap-2">
                <Link href={`/members/${m.id}?period=${pp}`} className="font-bold text-accent hover:underline">
                  {m.name}
                </Link>
                {d.main ? <StatusBadge status={d.main.status} /> : <StatusBadge status="良好" />}
              </div>
              <p className="text-sm font-semibold">{d.headline}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{d.reason}</p>
              <p className="mt-1 text-xs leading-relaxed">→ {d.advice}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
