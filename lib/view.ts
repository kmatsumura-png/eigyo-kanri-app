// グラフ・ランキング用にデータを並べ替えるところ
import { MEMBERS, MEMBER_COLORS, MONTHS, monthLabel } from "./config";
import { ALL_IDS, statsFor } from "./kpi";
import type { RankRow } from "@/components/Ranking";
import type { Dataset, MonthKey } from "./types";

export const memberSeries = MEMBERS.map((m) => ({ key: m.id, name: m.short, color: MEMBER_COLORS[m.id] }));

export function getByMonthData(ds: Dataset, ids = ALL_IDS) {
  return MONTHS.map((m) => {
    const row: Record<string, number | string> = { month: monthLabel(m) };
    for (const id of ids) row[id] = statsFor(ds, [id], [m]).gets;
    return row;
  });
}

export function rateByMonthData(ds: Dataset, ids = ALL_IDS) {
  return MONTHS.map((m) => {
    const row: Record<string, number | string | null> = { month: monthLabel(m) };
    for (const id of ids) row[id] = statsFor(ds, [id], [m]).contractRate;
    row.team = statsFor(ds, ALL_IDS, [m]).contractRate;
    return row;
  });
}

export function rankRows(ds: Dataset, months: MonthKey[]): RankRow[] {
  return MEMBERS.map((m) => {
    const s = statsFor(ds, [m.id], months);
    return {
      id: m.id,
      name: m.short,
      actions: s.actions,
      gets: s.gets,
      rate: s.contractRate,
      amount: s.amount,
      unitPrice: s.unitPrice,
      points: s.points,
      pendingCount: s.pendingCount,
    };
  });
}
