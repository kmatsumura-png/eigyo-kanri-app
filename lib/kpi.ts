// ============================================================
// KPI の計算ルール
//   商談数 ＝ 行動数
//   契約数 ＝ GET数
//   契約率 ＝ 契約数 ÷ 商談数（3か月は「合計 ÷ 合計」で計算）
//   契約金額 ＝ 案件一覧の最終販売価格（金額が確定しているものだけ）
//   平均単価 ＝ 契約金額合計 ÷ 金額が確定している契約の件数
// ============================================================
import { MEMBERS, MONTHS, PERIOD_TITLE, monthLabel } from "./config";
import type { Contract, Dataset, MonthKey, Period } from "./types";

// ---------- 期間 ----------
/** URL の ?period=7 などを読み取る。何もなければ 7〜9月 */
export function parsePeriod(v: string | string[] | undefined): Period {
  const s = Array.isArray(v) ? v[0] : v;
  const hit = MONTHS.find((m) => String(Number(m.slice(5, 7))) === s);
  return hit ?? "all";
}
export function periodMonths(p: Period): MonthKey[] {
  return p === "all" ? MONTHS : [p];
}
export function periodLabel(p: Period): string {
  return p === "all" ? PERIOD_TITLE : `2026年${monthLabel(p)}`;
}
export function periodParam(p: Period): string {
  return p === "all" ? "all" : String(Number(p.slice(5, 7)));
}
/** 1つ前の月（7月なら null） */
export function prevMonth(m: MonthKey): MonthKey | null {
  const i = MONTHS.indexOf(m);
  return i > 0 ? MONTHS[i - 1] : null;
}

// ---------- 集計 ----------
export interface Stats {
  months: number; // 何か月分か
  actions: number; // 行動数（＝商談数）
  gets: number; // GET数（＝契約数）
  points: number;
  calls: number | null; // 打電数（データがない月を含むと null）
  contacts: number | null;
  appts: number | null;
  amount: number; // 確定した契約金額の合計
  amountCount: number; // 金額が確定している契約の件数
  pendingCount: number; // 金額要確認の契約の件数
  pendingCandidate: number; // 要確認の候補金額の合計（参考）
  contractRows: number; // 案件一覧の契約行の数
  // ↓ 計算した率
  contractRate: number | null; // 契約率 ＝ GET ÷ 行動
  unitPrice: number | null; // 平均単価
  contactRate: number | null; // 接触率 ＝ 接触 ÷ 打電
  apptRate: number | null; // アポ率 ＝ アポ ÷ 打電
}

const div = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b);
const sumOrNull = (vals: (number | null)[]) => (vals.some((v) => v === null) ? null : vals.reduce<number>((s, v) => s + (v ?? 0), 0));

export function contractsFor(ds: Dataset, memberIds: string[], months: MonthKey[]): Contract[] {
  const names = MEMBERS.filter((m) => memberIds.includes(m.id)).map((m) => m.name);
  return ds.contracts.filter((c) => c.kind === "契約" && names.includes(c.salesStaff) && months.includes(c.month));
}

export function statsFor(ds: Dataset, memberIds: string[], months: MonthKey[]): Stats {
  const ks = ds.kpis.filter((k) => memberIds.includes(k.memberId) && months.includes(k.month));
  const cs = contractsFor(ds, memberIds, months);
  const actions = ks.reduce((s, k) => s + k.actions, 0);
  const gets = ks.reduce((s, k) => s + k.gets, 0);
  const calls = sumOrNull(ks.map((k) => k.calls));
  const contacts = sumOrNull(ks.map((k) => k.contacts));
  const appts = sumOrNull(ks.map((k) => k.appts));
  const confirmed = cs.filter((c) => c.amountStatus === "確定" && c.amount !== null);
  const pending = cs.filter((c) => c.amountStatus === "要確認");
  const amount = confirmed.reduce((s, c) => s + (c.amount ?? 0), 0);
  return {
    months: months.length,
    actions,
    gets,
    points: ks.reduce((s, k) => s + k.points, 0),
    calls,
    contacts,
    appts,
    amount,
    amountCount: confirmed.length,
    pendingCount: pending.length,
    pendingCandidate: pending.reduce((s, c) => s + (c.candidateAmount ?? 0), 0),
    contractRows: cs.length,
    contractRate: div(gets, actions),
    unitPrice: confirmed.length ? amount / confirmed.length : null,
    contactRate: div(contacts, calls),
    apptRate: div(appts, calls),
  };
}

/** 3か月平均：件数・金額は ÷月数、率は「合計 ÷ 合計」のまま */
export function monthlyAverage(s: Stats): Stats {
  const n = s.months || 1;
  const d = (v: number | null) => (v === null ? null : v / n);
  return {
    ...s,
    actions: s.actions / n,
    gets: s.gets / n,
    points: s.points / n,
    calls: d(s.calls),
    contacts: d(s.contacts),
    appts: d(s.appts),
    amount: s.amount / n,
    amountCount: s.amountCount / n,
    pendingCount: s.pendingCount / n,
    pendingCandidate: s.pendingCandidate / n,
    contractRows: s.contractRows / n,
  };
}

export const ALL_IDS = MEMBERS.map((m) => m.id);

/** チーム平均（1人あたり）。率はチーム合計から計算 */
export function teamPerPerson(ds: Dataset, months: MonthKey[]): Stats {
  const t = statsFor(ds, ALL_IDS, months);
  const n = MEMBERS.length;
  const d = (v: number | null) => (v === null ? null : v / n);
  return {
    ...t,
    actions: t.actions / n,
    gets: t.gets / n,
    points: t.points / n,
    calls: d(t.calls),
    contacts: d(t.contacts),
    appts: d(t.appts),
    amount: t.amount / n,
  };
}

// ---------- 商品別 ----------
export interface ProductRow {
  category: string;
  count: number; // 契約件数（セット商品はそれぞれに1件）
  amount: number; // 単品で金額確定しているものの合計
}
export function productSummary(contracts: Contract[]): ProductRow[] {
  const map = new Map<string, ProductRow>();
  for (const c of contracts) {
    for (const cat of c.productCategories) {
      const row = map.get(cat) ?? { category: cat, count: 0, amount: 0 };
      row.count += 1;
      if (c.productCategories.length === 1 && c.amountStatus === "確定") row.amount += c.amount ?? 0;
      map.set(cat, row);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
