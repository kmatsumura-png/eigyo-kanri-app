// ============================================================
// アプリの基本設定
// 対象メンバーや対象月を変えたいときは、このファイルだけを直せばOKです。
// ============================================================
import type { Member, MonthKey } from "./types";

/** 営業管理の対象メンバー（この5人以外は表示しません） */
export const MEMBERS: Member[] = [
  { id: "matsumura", name: "松村弘稀", short: "松村" },
  { id: "enomoto", name: "榎本潤一", short: "榎本" },
  { id: "mori", name: "森健太", short: "森" },
  { id: "tsujimoto", name: "辻本大祐", short: "辻本" },
  { id: "hayasaka", name: "早坂好生", short: "早坂" },
];

/** 対象の月（古い順） */
export const MONTHS: MonthKey[] = ["2026-07", "2026-08", "2026-09"];

/** 画面に出すタイトル */
export const PERIOD_TITLE = "2026年7月〜9月";

export function monthLabel(m: MonthKey): string {
  return `${Number(m.slice(5, 7))}月`;
}

/** 商品を集計用の分類に分けるルール（上から順に判定） */
export const PRODUCT_CATEGORIES: { name: string; pattern: RegExp }[] = [
  { name: "ホームページ強化パック", pattern: /ホームページ強化パック/ },
  { name: "AIホームページ", pattern: /AIホームページ/ },
  { name: "求人コンテンツ強化パック", pattern: /求人コンテンツ/ },
  { name: "動画", pattern: /動画|TikTok/i },
  { name: "ブログ自動投稿・運用サポート", pattern: /ブログ自動投稿|運用サポート/ },
  { name: "ページ追加", pattern: /ページ追加/ },
];
export const OTHER_CATEGORY = "その他";

/** グラフでの各メンバーの色（人ごとに固定。順位で色が変わらないように） */
export const MEMBER_COLORS: Record<string, string> = {
  matsumura: "#2a78d6",
  enomoto: "#eb6834",
  mori: "#1baf7a",
  tsujimoto: "#eda100",
  hayasaka: "#e87ba4",
};

/**
 * 標準価格（備考に販売金額が書かれていないときに使う価格表）
 * ・上から順に判定します（30記事を15記事より先に書いています）
 * ・from / until は「受注した月」で、価格が変わる時期を表します（YYYY-MM）
 * ・値引きありの案件は、金額が書かれていなければ「要確認」にします
 */
export const PRICE_LIST: { name: string; pattern: RegExp; price: number; from?: string; until?: string }[] = [
  { name: "ホームページ強化パックライト", pattern: /ホームページ強化パックライト/, price: 1100000 },
  { name: "ブログ自動投稿30記事", pattern: /ブログ自動投稿\s*30記事/, price: 528000 },
  { name: "ブログ自動投稿15記事・運用サポートサービス", pattern: /ブログ自動投稿\s*15記事|運用サポート/, price: 396000 },
  { name: "AIホームページ（〜2026年9月）", pattern: /AIホームページ|AIHP/i, price: 396000, until: "2026-09" },
  { name: "AIホームページ（2026年10月〜）", pattern: /AIホームページ|AIHP/i, price: 435600, from: "2026-10" },
];

/** この言葉が備考にあれば「口座振替」（契約数には入れるが、契約金額には計上しない） */
export const DIRECT_DEBIT_PATTERN = /口振|口座振替/;
