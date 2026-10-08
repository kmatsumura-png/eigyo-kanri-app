// ============================================================
// 数字から「コメント」と「課題」を自動で作るルール
//
// ・必ず数字を根拠にします（推測や精神論は書きません）
// ・今はルールで作っていますが、将来 AI に置き換える場合は
//   このファイルの関数の中身を差し替えれば、画面はそのまま使えます
// ============================================================
import { MEMBERS, MONTHS, monthLabel } from "./config";
import { fmtMan, fmtNum, fmtPct, fmtYen } from "./format";
import { contractsFor, prevMonth, productSummary, statsFor, teamPerPerson, type Stats, ALL_IDS } from "./kpi";
import type { Dataset, MonthKey, Period } from "./types";

export type Tone = "good" | "bad" | "neutral";

export interface Comment {
  tone: Tone;
  text: string;
}

// ---------- 課題の判定（どこを改善すれば数字が伸びるか） ----------
export type StageKey = "appts" | "actions" | "rate" | "unit";
export type StageStatus = "良好" | "やや低い" | "課題" | "データ不足";

export interface StageCheck {
  key: StageKey;
  label: string; // 例: アポ獲得
  metric: string; // 例: アポ数
  value: string;
  team: string;
  ratio: number | null; // チーム平均に対する割合（1.0 = 平均と同じ）
  status: StageStatus;
}

export interface Diagnosis {
  memberId: string;
  stages: StageCheck[];
  main: StageCheck | null; // 一番先に直すべきところ
  headline: string; // 一言でいうと
  reason: string; // 数字の根拠
  advice: string; // 改善したときの効果（数字）
}

/** 判定の基準：チーム平均の 85% 未満なら「課題」、100% 未満なら「やや低い」 */
const ISSUE_LINE = 0.85;

function judge(v: number | null, t: number | null, enough = true): { ratio: number | null; status: StageStatus } {
  if (v === null || t === null || t === 0 || !enough) return { ratio: null, status: "データ不足" };
  const ratio = v / t;
  return { ratio, status: ratio >= 1 ? "良好" : ratio >= ISSUE_LINE ? "やや低い" : "課題" };
}

export function diagnose(ds: Dataset, memberId: string, months: MonthKey[]): Diagnosis {
  const s = statsFor(ds, [memberId], months);
  const t = teamPerPerson(ds, months);
  const per = months.length > 1 ? "（月平均）" : "";
  const n = months.length;

  const stages: StageCheck[] = [
    {
      key: "appts",
      label: "アポ獲得",
      metric: `アポ数${per}`,
      value: s.appts === null ? "—" : `${fmtNum(s.appts / n, 1)}件`,
      team: t.appts === null ? "—" : `${fmtNum(t.appts / n, 1)}件`,
      ...judge(s.appts, t.appts),
    },
    {
      key: "actions",
      label: "行動量",
      metric: `行動数${per}`,
      value: `${fmtNum(s.actions / n, 1)}件`,
      team: `${fmtNum(t.actions / n, 1)}件`,
      ...judge(s.actions, t.actions),
    },
    {
      key: "rate",
      label: "成約",
      metric: "契約率",
      value: fmtPct(s.contractRate),
      team: fmtPct(t.contractRate),
      ...judge(s.contractRate, t.contractRate, s.actions > 0),
    },
    {
      key: "unit",
      label: "単価",
      metric: "平均単価",
      value: s.amountCount >= 2 ? fmtMan(s.unitPrice) : "—",
      team: fmtMan(t.unitPrice),
      ...judge(s.unitPrice, t.unitPrice, s.amountCount >= 2),
    },
  ];

  const main = stages.find((x) => x.status === "課題") ?? stages.find((x) => x.status === "やや低い") ?? null;
  const { headline, reason, advice } = explain(main, s, t, n);
  return { memberId, stages, main, headline, reason, advice };
}

function explain(main: StageCheck | null, s: Stats, t: Stats, n: number) {
  if (!main) {
    return {
      headline: "大きな課題は見当たりません",
      reason: `アポ数・行動数・契約率・平均単価がすべてチーム平均以上です（契約率 ${fmtPct(s.contractRate)}／チーム ${fmtPct(t.contractRate)}）。`,
      advice: "今のやり方を続けつつ、チームへの共有役をお願いすると全体が伸びます。",
    };
  }
  const tr = t.contractRate ?? 0;
  switch (main.key) {
    case "appts": {
      const diff = ((t.appts ?? 0) - (s.appts ?? 0)) / n;
      return {
        headline: "アポ獲得に課題があります",
        reason: `アポ数が月${fmtNum((s.appts ?? 0) / n, 1)}件で、チーム平均（${fmtNum((t.appts ?? 0) / n, 1)}件）より少ないです。アポ率（アポ÷打電）は ${fmtPct(s.apptRate, 2)}（チーム ${fmtPct(t.apptRate, 2)}）。`,
        advice: `アポをチーム平均まで月+${fmtNum(diff, 1)}件増やすことが、行動数・GET数を増やす一番の近道です。`,
      };
    }
    case "actions": {
      const diff = (t.actions - s.actions) / n;
      const gain = diff * (s.contractRate ?? 0);
      return {
        headline: "行動数（商談数）が少ないです",
        reason: `行動数が月${fmtNum(s.actions / n, 1)}件で、チーム平均（${fmtNum(t.actions / n, 1)}件）を下回っています。`,
        advice: `行動数をチーム平均まで月+${fmtNum(diff, 1)}件増やせば、今の契約率 ${fmtPct(s.contractRate)} のままでもGETは月+${fmtNum(gain, 1)}件の見込みです。`,
      };
    }
    case "rate": {
      const expected = s.actions * tr;
      return {
        headline: "商談後の成約率に課題がある可能性があります",
        reason: `行動数${fmtNum(s.actions)}件に対してGET数${fmtNum(s.gets)}件で、契約率 ${fmtPct(s.contractRate)} はチーム平均（${fmtPct(t.contractRate)}）を下回っています。`,
        advice: `チーム平均の契約率で成約できれば、同じ行動数でGETは約${fmtNum(expected, 1)}件（+${fmtNum(expected - s.gets, 1)}件）になります。商談の進め方・クロージングの確認がおすすめです。`,
      };
    }
    case "unit": {
      const gap = ((t.unitPrice ?? 0) - (s.unitPrice ?? 0)) * s.amountCount;
      return {
        headline: "GETは取れていますが、平均単価に課題があります",
        reason: `平均単価 ${fmtYen(s.unitPrice)} は、チーム平均（${fmtYen(t.unitPrice)}）より低いです（金額確定 ${s.amountCount}件で計算${s.pendingCount ? `。金額要確認の${s.pendingCount}件は含まれていないため、確認後に変わる可能性があります` : ""}）。`,
        advice: `同じ件数でも単価がチーム平均なら、契約金額は約+${fmtMan(gap)}になります。上位商品の提案・値引きの見直しがおすすめです。`,
      };
    }
  }
}

// ---------- 個人のコメント ----------
function change(label: string, a: number | null, b: number | null, unit: string, fmt: (v: number) => string, digitsDiff = 0): Comment | null {
  if (a === null || b === null) return null;
  const d = b - a;
  if (Math.abs(d) < 1e-9) return { tone: "neutral", text: `${label}は前月と同じ（${fmt(b)}）です。` };
  const up = d > 0;
  return {
    tone: up ? "good" : "bad",
    text: `${label}が前月より${up ? "+" : "-"}${Math.abs(d).toFixed(digitsDiff)}${unit}${up ? "増加" : "減少"}（${fmt(a)} → ${fmt(b)}）。`,
  };
}

function rateChange(a: number | null, b: number | null): Comment | null {
  if (a === null || b === null) return null;
  const d = (b - a) * 100;
  if (Math.abs(d) < 0.05) return { tone: "neutral", text: `契約率は前月と同じ（${fmtPct(b)}）です。` };
  return {
    tone: d > 0 ? "good" : "bad",
    text: `契約率が前月より${Math.abs(d).toFixed(1)}%${d > 0 ? "上昇" : "低下"}（${fmtPct(a)} → ${fmtPct(b)}）。`,
  };
}

/** 個人ページに出すコメント。期間が「7〜9月」のときは 9月と8月を比べます */
export function memberComments(ds: Dataset, memberId: string, period: Period): Comment[] {
  const out: Comment[] = [];
  const months = period === "all" ? MONTHS : [period];
  const target = period === "all" ? MONTHS[MONTHS.length - 1] : period;
  const prev = prevMonth(target);
  const s = statsFor(ds, [memberId], months);
  const t = teamPerPerson(ds, months);

  if (prev) {
    const a = statsFor(ds, [memberId], [prev]);
    const b = statsFor(ds, [memberId], [target]);
    const prefix = `【${monthLabel(target)}】`;
    for (const c of [
      change("GET数", a.gets, b.gets, "件", (v) => `${fmtNum(v)}件`),
      rateChange(a.contractRate, b.contractRate),
      change("行動数", a.actions, b.actions, "件", (v) => `${fmtNum(v)}件`),
      change("ポイント", a.points, b.points, "pt", (v) => `${fmtNum(v, 1)}pt`, 1),
    ]) {
      if (c) out.push({ ...c, text: prefix + c.text });
    }
  }

  // チーム平均との比較
  if (s.contractRate !== null && t.contractRate !== null) {
    const d = (s.contractRate - t.contractRate) * 100;
    out.push({
      tone: d >= 0 ? "good" : "bad",
      text: `契約率 ${fmtPct(s.contractRate)} は、チーム平均（${fmtPct(t.contractRate)}）を${Math.abs(d).toFixed(1)}%${d >= 0 ? "上回っています" : "下回っています"}。`,
    });
  }
  // 行動は多いのに GET が少ない
  if (s.actions >= t.actions && s.contractRate !== null && t.contractRate !== null && s.contractRate < t.contractRate * ISSUE_LINE) {
    out.push({
      tone: "bad",
      text: `行動数（${fmtNum(s.actions)}件）はチーム平均（${fmtNum(t.actions, 1)}件）以上ですが、GET数が${fmtNum(s.gets)}件と少ないため、商談後の成約率に課題がある可能性があります。`,
    });
  }
  // 3か月の流れ
  if (period === "all" && MONTHS.length >= 3) {
    const rates = MONTHS.map((m) => statsFor(ds, [memberId], [m]).contractRate);
    if (rates.every((r) => r !== null)) {
      const r = rates as number[];
      if (r.every((v, i) => i === 0 || v > r[i - 1])) out.push({ tone: "good", text: `契約率が${MONTHS.length}か月連続で上がっています（${r.map((v) => fmtPct(v)).join(" → ")}）。` });
      if (r.every((v, i) => i === 0 || v < r[i - 1])) out.push({ tone: "bad", text: `契約率が${MONTHS.length}か月連続で下がっています（${r.map((v) => fmtPct(v)).join(" → ")}）。` });
    }
  }
  // 平均単価
  if (s.amountCount >= 2 && s.unitPrice !== null && t.unitPrice !== null) {
    const r = s.unitPrice / t.unitPrice;
    if (r >= 1.1) out.push({ tone: "good", text: `平均単価 ${fmtMan(s.unitPrice)} はチーム平均（${fmtMan(t.unitPrice)}）より高いです。` });
    if (r < ISSUE_LINE) out.push({ tone: "bad", text: `平均単価 ${fmtMan(s.unitPrice)} はチーム平均（${fmtMan(t.unitPrice)}）より低いです。` });
  }
  if (s.pendingCount > 0) {
    out.push({ tone: "neutral", text: `契約${s.contractRows}件のうち${s.pendingCount}件は「金額要確認」のため、契約金額・平均単価に入っていません。` });
  }
  return out;
}

// ---------- ダッシュボードの「30秒でわかる要点」 ----------
export interface Summary {
  hot: Comment[]; // 調子がいい人
  down: Comment[]; // 落ちている人
  coaching: { memberId: string; text: string }[]; // 誰に何を指導するか
  team: Comment[]; // チーム全体
}

export function teamSummary(ds: Dataset, period: Period): Summary {
  const months = period === "all" ? MONTHS : [period];
  const target = period === "all" ? MONTHS[MONTHS.length - 1] : period;
  const prev = prevMonth(target);
  const hot: Comment[] = [];
  const down: Comment[] = [];

  if (prev) {
    const rows = MEMBERS.map((m) => ({
      m,
      a: statsFor(ds, [m.id], [prev]),
      b: statsFor(ds, [m.id], [target]),
    }));
    const byGet = [...rows].sort((x, y) => y.b.gets - y.a.gets - (x.b.gets - x.a.gets));
    for (const r of byGet) {
      const d = r.b.gets - r.a.gets;
      const text = `${r.m.short}：GET ${r.a.gets}件 → ${r.b.gets}件（${d > 0 ? "+" : ""}${d}件）、契約率 ${fmtPct(r.a.contractRate)} → ${fmtPct(r.b.contractRate)}`;
      if (d > 0) hot.push({ tone: "good", text });
      else if (d < 0) down.push({ tone: "bad", text });
      else if ((r.b.contractRate ?? 0) < (r.a.contractRate ?? 0) - 0.05) down.push({ tone: "bad", text });
    }
  }

  const coaching = MEMBERS.map((m) => ({ m, d: diagnose(ds, m.id, months) }))
    .filter((x) => x.d.main && x.d.main.status === "課題")
    .map((x) => ({ memberId: x.m.id, text: `${x.m.short}：${x.d.headline}（${x.d.main!.metric} ${x.d.main!.value}／チーム平均 ${x.d.main!.team}）` }));

  const team: Comment[] = [];
  const s = statsFor(ds, ALL_IDS, months);
  if (prev) {
    const a = statsFor(ds, ALL_IDS, [prev]);
    const b = statsFor(ds, ALL_IDS, [target]);
    const rc = rateChange(a.contractRate, b.contractRate);
    if (rc) team.push({ ...rc, text: `チームの${monthLabel(target)}の` + rc.text });
  }
  team.push({ tone: "neutral", text: `${period === "all" ? "3か月" : monthLabel(target)}のチーム契約率は ${fmtPct(s.contractRate)}（行動${fmtNum(s.actions)}件・GET${fmtNum(s.gets)}件）。` });
  const top = productSummary(contractsFor(ds, ALL_IDS, months))[0];
  if (top) team.push({ tone: "neutral", text: `一番売れている商品は「${top.category}」（${top.count}件）。` });
  if (s.pendingCount > 0) team.push({ tone: "neutral", text: `契約金額が「要確認」の案件が${s.pendingCount}件あります（案件一覧で確認できます）。` });

  return { hot, down, coaching, team };
}

// ---------- 個人の「強み」と「改善すべき点」 ----------
export interface StrengthReport {
  strengths: string[]; // この人は何が強いのか
  improvements: string[]; // どこを改善すべきか
}

/** 強みとみなす基準：チーム平均の 105% 以上 */
const STRONG_LINE = 1.05;

export function strengthReport(ds: Dataset, memberId: string, period: Period): StrengthReport {
  const months = period === "all" ? MONTHS : [period];
  const s = statsFor(ds, [memberId], months);
  const t = teamPerPerson(ds, months);
  const n = months.length;
  const per = n > 1 ? "月" : "";
  const strengths: string[] = [];
  const improvements: string[] = [];
  const cnt = (v: number | null, unit: string) => (v === null ? "—" : `${per}${fmtNum(v / n, n > 1 ? 1 : 0)}${unit}`);

  const rateLow = s.contractRate !== null && t.contractRate !== null && s.contractRate < t.contractRate * ISSUE_LINE;
  const actionsHigh = s.actions >= t.actions * STRONG_LINE;

  // 行動数と契約率（組み合わせで見る）
  if (actionsHigh && rateLow) {
    improvements.push(
      `行動数は多い（${cnt(s.actions, "件")}／平均${cnt(t.actions, "件")}）が、GET率が低い（${fmtPct(s.contractRate)}／平均${fmtPct(t.contractRate)}）。商談後の成約に課題がある可能性があります。`,
    );
  } else {
    if (actionsHigh) strengths.push(`行動数がチーム平均より多い（${cnt(s.actions, "件")}／平均${cnt(t.actions, "件")}）`);
    else if (s.actions < t.actions * 0.95) improvements.push(`行動数がチーム平均より少ない（${cnt(s.actions, "件")}／平均${cnt(t.actions, "件")}）`);
    if (s.contractRate !== null && t.contractRate !== null) {
      if (s.contractRate >= t.contractRate)
        strengths.push(`契約率がチーム平均以上（${fmtPct(s.contractRate)}／平均${fmtPct(t.contractRate)}）`);
      else if (rateLow) improvements.push(`契約率がチーム平均を下回っている（${fmtPct(s.contractRate)}／平均${fmtPct(t.contractRate)}）`);
    }
  }

  // GET数
  if (s.gets >= t.gets * STRONG_LINE) strengths.push(`GET数がチーム平均より多い（${cnt(s.gets, "件")}／平均${cnt(t.gets, "件")}）`);
  else if (s.gets < t.gets * ISSUE_LINE) improvements.push(`GET数がチーム平均より少ない（${cnt(s.gets, "件")}／平均${cnt(t.gets, "件")}）`);

  // アポ数
  if (s.appts !== null && t.appts !== null) {
    if (s.appts >= t.appts * STRONG_LINE) strengths.push(`自分で取るアポ数が多い（${cnt(s.appts, "件")}／平均${cnt(t.appts, "件")}）`);
    else if (s.appts < t.appts * ISSUE_LINE) improvements.push(`自分で取るアポ数が少ない（${cnt(s.appts, "件")}／平均${cnt(t.appts, "件")}）`);
  }

  // 平均単価（金額が確定した契約が2件以上あるときだけ判断）
  const pendingNote = s.pendingCount ? `。金額要確認${s.pendingCount}件は含まず` : "";
  if (s.amountCount >= 2 && s.unitPrice !== null && t.unitPrice !== null) {
    if (s.unitPrice >= t.unitPrice * STRONG_LINE) strengths.push(`平均単価が高い（${fmtMan(s.unitPrice)}／平均${fmtMan(t.unitPrice)}${pendingNote}）`);
    else if (s.unitPrice < t.unitPrice * ISSUE_LINE) improvements.push(`平均単価が低い（${fmtMan(s.unitPrice)}／平均${fmtMan(t.unitPrice)}${pendingNote}）`);
  }

  // ポイント
  if (s.points >= t.points * STRONG_LINE) strengths.push(`ポイントがチーム平均より多い（${cnt(s.points, "pt")}／平均${cnt(t.points, "pt")}）`);
  else if (s.points < t.points * ISSUE_LINE) improvements.push(`ポイントがチーム平均より少ない（${cnt(s.points, "pt")}／平均${cnt(t.points, "pt")}）`);

  // 前月との比較（7〜9月のときは 9月 と 8月）
  const target = period === "all" ? MONTHS[MONTHS.length - 1] : period;
  const prev = prevMonth(target);
  if (prev) {
    const a = statsFor(ds, [memberId], [prev]);
    const b = statsFor(ds, [memberId], [target]);
    const tag = `${monthLabel(target)}は`;
    if (b.gets > a.gets) strengths.push(`${tag}前月よりGET数が増加（${a.gets}件 → ${b.gets}件）`);
    if (b.gets < a.gets) improvements.push(`${tag}前月よりGET数が減少（${a.gets}件 → ${b.gets}件）`);
    if (a.contractRate !== null && b.contractRate !== null) {
      const d = (b.contractRate - a.contractRate) * 100;
      if (d >= 5) strengths.push(`${tag}契約率が前月より${d.toFixed(1)}%上昇（${fmtPct(a.contractRate)} → ${fmtPct(b.contractRate)}）`);
      if (d <= -5) improvements.push(`${tag}契約率が前月より${Math.abs(d).toFixed(1)}%低下（${fmtPct(a.contractRate)} → ${fmtPct(b.contractRate)}）`);
    }
    if (b.actions < a.actions * 0.85) improvements.push(`${tag}前月より行動数が減少（${a.actions}件 → ${b.actions}件）`);
  }

  return { strengths, improvements };
}
