// 数字の表示のしかた（カンマ・%・万円など）

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 0.3 → "30.0%" */
export function fmtPct(r: number | null | undefined, digits = 1): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return "—";
  return `${(r * 100).toFixed(digits)}%`;
}

/** 1300000 → "1,300,000円" */
export function fmtYen(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

/** 13000000 → "1,300.0万円"（大きな数字を短く） */
export function fmtMan(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n / 10000).toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}万円`;
}

/** 差を「+3件」「-2.5pt」のように */
export function fmtDiff(n: number, unit: string, digits = 0): string {
  const s = Math.abs(n).toFixed(digits);
  return `${n > 0 ? "+" : n < 0 ? "-" : "±"}${s}${unit}`;
}

export function fmtDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${Number(m[2])}/${Number(m[3])}` : s;
}
