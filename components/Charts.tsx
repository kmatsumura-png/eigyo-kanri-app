"use client";
// グラフ（Recharts というグラフ部品を使っています）
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

const AXIS = { fontSize: 12, fill: "#545862" };
const GRID = "#eceef1";
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e4e6ea" };
const legendStyle = { fontSize: 12, paddingBottom: 8 };

const pct = (v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—");
const man = (v: unknown) => (typeof v === "number" ? `${(v / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円` : "—");

/** ① 月別GET数（月ごとに、誰が何件GETしたか） */
export function GetByMonthChart({ data, series }: { data: Record<string, number | string>[]; series: SeriesDef[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}件`} cursor={{ fill: "#f5f6f8" }} />
        <Legend verticalAlign="top" align="left" iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** ② 月別契約率（上がっているか・下がっているか） */
export function RateByMonthChart({ data, series }: { data: Record<string, number | string | null>[]; series: SeriesDef[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} padding={{ left: 16, right: 16 }} />
        <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => pct(v)} />
        <Legend verticalAlign="top" align="left" iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.key === "team" ? 2 : 2}
            strokeDasharray={s.key === "team" ? "5 4" : undefined}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** ③ 行動数とGET数（行動しているのにGETが少ない人を見つける） */
export function ActionVsGetChart({ data }: { data: { name: string; actions: number; gets: number; rateLabel: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} margin={{ top: 20, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}件`} cursor={{ fill: "#f5f6f8" }} />
        <Legend verticalAlign="top" align="left" iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
        <Bar dataKey="actions" name="行動数" fill="#b8bcc4" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="gets" name="GET数" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={28}>
          <LabelList dataKey="rateLabel" position="top" style={{ fontSize: 11, fill: "#16181d", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** ④ 契約金額（誰がどれだけ売上を作っているか） */
export function AmountChart({ data }: { data: { name: string; amount: number; pending: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
        <defs>
          <pattern id="pending-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#e9eaee" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#9aa0aa" strokeWidth="2" />
          </pattern>
        </defs>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => man(v)} cursor={{ fill: "#f5f6f8" }} />
        <Legend verticalAlign="top" align="left" iconType="square" iconSize={10} wrapperStyle={legendStyle} />
        <Bar dataKey="amount" name="確定した契約金額" stackId="a" fill="#2a78d6" maxBarSize={22} />
        <Bar dataKey="pending" name="金額要確認（候補）" stackId="a" fill="url(#pending-stripe)" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
