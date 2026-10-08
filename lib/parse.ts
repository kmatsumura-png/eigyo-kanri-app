// ============================================================
// 備考欄の文章から「商品」と「最終販売価格」を読み取るルール
// ============================================================
import { OTHER_CATEGORY, PRODUCT_CATEGORIES } from "./config";

/** 全角数字・カンマなどを半角にそろえる */
export function normalizeText(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,](?=\d{3})/g, "")
    .replace(/＋/g, "+")
    .replace(/→|⇒|->/g, "→");
}

/** 商品名を集計用の分類に分ける。セット商品は複数の分類になります */
export function productCategories(product: string): string[] {
  const parts = normalizeText(product)
    .split(/[+・]/)
    .map((p) => p.trim())
    .filter((p) => p && !/[（(]サービス[）)]/.test(p)); // 無料サービスは数えない
  const cats = new Set<string>();
  for (const part of parts) {
    const hit = PRODUCT_CATEGORIES.find((c) => c.pattern.test(part));
    cats.add(hit ? hit.name : OTHER_CATEGORY);
  }
  return cats.size ? [...cats] : [OTHER_CATEGORY];
}

export function isMultiProduct(product: string): boolean {
  return productCategories(product).length > 1;
}

export interface AmountResult {
  amount: number | null; // 確定した金額
  candidate: number | null; // 読み取れた候補（要確認のときの参考）
  status: "確定" | "要確認";
  reason: string;
}

/**
 * 備考から最終販売価格を読み取る。
 *   「1100000円→1300000円で販売」 → 1,300,000円（右側の金額）
 *   「80000円で販売」              → 80,000円
 * 機械的に判断すると間違えそうなものは「要確認」にして、金額を入れません。
 */
export function parseAmount(memo: string, product: string, discountCheck: string): AmountResult {
  const text = normalizeText(memo);
  const pairs = [...text.matchAll(/(\d{4,})円?\s*→\s*(\d{4,})円/g)].map((m) => ({
    from: Number(m[1]),
    to: Number(m[2]),
  }));
  const singles = [...text.matchAll(/(?<![→\d])(\d{4,})円で販売/g)].map((m) => Number(m[1]));

  const ng = (candidate: number | null, reason: string): AmountResult => ({
    amount: null,
    candidate,
    status: "要確認",
    reason,
  });

  let candidate: number | null = null;
  if (pairs.length === 1) candidate = pairs[0].to;
  else if (pairs.length === 0 && singles.length === 1) candidate = singles[0];

  if (/月額|口振|口座振替/.test(text)) {
    return ng(candidate, "月額・口座振替の契約のため、契約金額を単純に計算できません");
  }
  if (pairs.length > 1 || singles.length > 1) {
    return ng(null, "備考に金額が複数書かれています");
  }
  if (candidate === null) {
    return ng(null, "備考に販売金額の記載がありません");
  }
  if (pairs.length === 1) {
    const { from, to } = pairs[0];
    if (/値上げ/.test(discountCheck) && to < from) {
      return ng(candidate, `「値上げあり」なのに金額が下がっています（${from.toLocaleString()}円→${to.toLocaleString()}円）`);
    }
    if (/値引きあり/.test(discountCheck) && to > from) {
      return ng(candidate, `「値引きあり」なのに金額が上がっています（${from.toLocaleString()}円→${to.toLocaleString()}円）`);
    }
  }
  if (isMultiProduct(product)) {
    return ng(candidate, "複数商品のセット価格です。この金額で正しいか確認してください");
  }
  return { amount: candidate, candidate, status: "確定", reason: "" };
}
