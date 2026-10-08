// ④ 案件一覧：商談・契約案件を見る画面
import Link from "next/link";
import ContractTable from "@/components/ContractTable";
import MeetingList from "@/components/MeetingList";
import { NoData, PageTitle, Section } from "@/components/ui";
import { MEMBERS, MONTHS } from "@/lib/config";
import { getData } from "@/lib/data";
import { fmtMan } from "@/lib/format";
import { parsePeriod, periodLabel, periodMonths, periodParam, productSummary } from "@/lib/kpi";

export const dynamic = "force-dynamic";

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const ds = getData();
  if (!ds) return <NoData />;
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const months = periodMonths(period);
  const pp = periodParam(period);
  const tab = sp.tab === "meetings" ? "meetings" : "contracts";
  const who = MEMBERS.find((m) => m.id === sp.member);
  const names = who ? [who.name] : MEMBERS.map((m) => m.name);

  const contracts = ds.contracts.filter((c) => names.includes(c.salesStaff) && months.includes(c.month));
  const meetings = ds.meetings.filter((m) => names.includes(m.salesStaff));
  const products = productSummary(contracts.filter((c) => c.kind === "契約"));
  const link = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ period: pp, tab, ...(who ? { member: who.id } : {}) });
    for (const [k, v] of Object.entries(q)) v === undefined ? p.delete(k) : p.set(k, v);
    return `/deals?${p.toString()}`;
  };
  const chip = (active: boolean) =>
    `shrink-0 rounded-md border px-3 py-1 text-sm ${active ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:bg-bg"}`;

  return (
    <>
      <PageTitle title="案件一覧" sub={`${periodLabel(period)}・${who ? who.name : "5人全員"}`} />
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-1.5">
          <Link href={link({ tab: "contracts" })} className={chip(tab === "contracts")}>
            契約案件
          </Link>
          <Link href={link({ tab: "meetings" })} className={chip(tab === "meetings")}>
            商談（行動予定表）
          </Link>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <span className="self-center text-xs text-ink-3">営業担当</span>
          <Link href={link({ member: undefined })} className={chip(!who)}>
            全員
          </Link>
          {MEMBERS.map((m) => (
            <Link key={m.id} href={link({ member: m.id })} className={chip(who?.id === m.id)}>
              {m.short}
            </Link>
          ))}
        </div>
      </div>

      {tab === "contracts" ? (
        <>
          <Section title="商品別契約数" desc="セット商品はそれぞれに1件ずつ数えています。金額は「単品・金額確定」の契約だけの合計です。">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <div key={p.category} className="rounded-lg bg-bg p-3">
                  <div className="truncate text-xs text-ink-2">{p.category}</div>
                  <div className="num text-xl font-bold">
                    {p.count}
                    <span className="ml-0.5 text-sm font-medium text-ink-2">件</span>
                  </div>
                  <div className="num text-xs text-ink-3">{p.amount ? fmtMan(p.amount) : "—"}</div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="契約案件" desc="「確認・修正」から、契約金額・商品・備考・確認済みを修正できます">
            <ContractTable key={`${who?.id}-${pp}`} contracts={contracts} initialFilter={sp.status === "pending" ? "pending" : "all"} />
          </Section>
        </>
      ) : (
        <Section title="商談一覧" desc="トップチーム行動予定表より。行をタップすると詳細が開きます。">
          <MeetingList key={`${who?.id}-${pp}`} meetings={meetings} initialMonth={period === "all" ? MONTHS[MONTHS.length - 1] : period} showSales={!who} />
        </Section>
      )}
    </>
  );
}
