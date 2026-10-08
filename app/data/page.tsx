// データ確認：どの数字をどのファイルから取ったか・食い違い・要確認の一覧
import Link from "next/link";
import { NoData, PageTitle, Section } from "@/components/ui";
import { MEMBERS, MONTHS, monthLabel } from "@/lib/config";
import { getData } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import type { IssueLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const LEVEL_STYLE: Record<IssueLevel, string> = {
  データ不一致: "bg-[#fbe9e9] text-bad",
  要確認: "bg-[#fdf3e1] text-warn",
  参考: "bg-bg text-ink-2",
};

const RULES: [string, string][] = [
  ["商談数", "＝ 行動数（別の商談数は作りません）"],
  ["契約数", "＝ GET数"],
  ["契約率", "＝ GET数 ÷ 行動数 × 100（3か月は「3か月合計GET ÷ 3か月合計行動」）"],
  ["契約金額", "＝ 案件一覧の備考の最終販売価格（「1100000円→1300000円で販売」なら 1,300,000円）"],
  ["平均単価", "＝ 契約金額合計 ÷ 金額が確定している契約の件数"],
  ["3か月平均", "＝（7月＋8月＋9月）÷ 3。率だけは合計 ÷ 合計"],
  ["接触率", "＝ 接触数 ÷ 打電数"],
  ["アポ率", "＝ アポ数 ÷ 打電数"],
  ["GET率", "＝ GET数 ÷ 行動数（今回のルールでは契約率と同じ）"],
];

const AMOUNT_NG = [
  "備考に金額が書かれていない",
  "複数商品のセット価格（例：ホームページ＋ブログ）",
  "月額・口座振替の契約",
  "金額が複数書かれている",
  "「値上げあり」なのに金額が下がっている など、記載が食い違う",
  "マイナス計上・過去案件の修正・ポイントのないメモ行",
  "同じ顧客・同じ商品の案件が複数ある（重複の可能性）",
];

export default function DataPage() {
  const ds = getData();
  if (!ds) return <NoData />;
  const name = (id?: string) => MEMBERS.find((m) => m.id === id)?.short ?? "";
  const pendingContracts = ds.contracts.filter((c) => c.kind === "契約" && c.amountStatus === "要確認");
  const levels: IssueLevel[] = ["データ不一致", "要確認", "参考"];

  return (
    <>
      <PageTitle title="データ確認" sub={`最終取り込み：${new Date(ds.importedAt).toLocaleString("ja-JP")}`} />

      <Section title="どの数字を、どのファイルから取っているか" desc="上ほど優先度が高いデータです">
        <ul className="space-y-3 text-sm">
          {ds.sourceFiles.map((f) => (
            <li key={f.fileName} className="rounded-lg bg-bg p-3">
              <div className="text-xs text-ink-3">{f.role}</div>
              <div className="font-semibold">{f.fileName}</div>
              <div className="mt-1 text-xs leading-relaxed text-ink-2">{f.used}</div>
            </li>
          ))}
        </ul>
        {!ds.sourceFiles.some((f) => /KPI確定版/.test(f.fileName)) && (
          <p className="mt-3 text-xs text-ink-3">※「KPI確定版」の Excel が excel フォルダにないため、営業管理システムの値を確定KPIとして使っています。</p>
        )}
      </Section>

      <Section title="取り込んだ確定KPI" desc="行動・GET・ポイントはKPI確定版（なければ営業管理システム）の値。打電・アポは営業管理システムの月末時点の記録です。">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line text-xs text-ink-3">
              <tr>
                <th className="px-2 py-2 text-left font-medium">名前</th>
                <th className="px-2 py-2 text-left font-medium">月</th>
                {["行動", "GET", "ポイント", "打電", "接触", "アポ"].map((h) => (
                  <th key={h} className="px-2 py-2 text-right font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEMBERS.flatMap((m) =>
                MONTHS.map((mo, i) => {
                  const k = ds.kpis.find((x) => x.memberId === m.id && x.month === mo);
                  return (
                    <tr key={m.id + mo} className={i === MONTHS.length - 1 ? "border-b border-line" : ""}>
                      <td className="px-2 py-1.5 font-semibold">{i === 0 ? m.short : ""}</td>
                      <td className="px-2 py-1.5 text-ink-2">{monthLabel(mo)}</td>
                      {[k?.actions, k?.gets, k?.points, k?.calls, k?.contacts, k?.appts].map((v, j) => (
                        <td key={j} className="num px-2 py-1.5 text-right">
                          {v === null || v === undefined ? <span className="text-xs text-ink-3">データなし</span> : fmtNum(v, v % 1 ? 1 : 0)}
                        </td>
                      ))}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="データ不一致・要確認" desc="アプリは数字を勝手に書き換えません。食い違いはここに出します。">
        {levels.map((lv) => {
          const list = ds.issues.filter((i) => i.level === lv);
          if (!list.length) return null;
          return (
            <div key={lv} className="mb-4">
              <h3 className="mb-2 text-sm font-bold">
                <span className={`mr-2 rounded px-1.5 py-0.5 text-xs ${LEVEL_STYLE[lv]}`}>{lv}</span>
                {list.length}件
              </h3>
              <ul className="divide-y divide-line">
                {list.map((i, n) => (
                  <li key={n} className="py-2 text-sm">
                    <div className="font-semibold">
                      {[name(i.memberId), i.month ? monthLabel(i.month) : ""].filter(Boolean).join("・")}
                      {(i.memberId || i.month) && "："}
                      {i.title}
                    </div>
                    <div className="text-xs leading-relaxed text-ink-2">{i.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <p className="text-sm">
          金額要確認の契約：<b>{pendingContracts.length}件</b>
          <Link href="/deals?tab=contracts&status=pending&period=all" className="ml-2 text-accent hover:underline">
            案件一覧で確認・修正する →
          </Link>
        </p>
      </Section>

      <Section title="計算ルール">
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
          {RULES.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold">{k}</dt>
              <dd className="text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mb-1 mt-4 text-sm font-bold">「金額要確認」にするもの（勝手に推測しません）</h3>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
          {AMOUNT_NG.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}
