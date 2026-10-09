// ============================================================
// データの「形」を決めるファイル
// （どんな項目があるかの一覧表のようなものです）
// ============================================================

/** 月を表す文字列。例: "2026-07" */
export type MonthKey = string;

/** 画面で選べる期間。"all" は 7〜9月 の3か月 */
export type Period = MonthKey | "all";

export interface Member {
  id: string; // URL に使う英字の名前（例: matsumura）
  name: string; // フルネーム（例: 松村弘稀）
  short: string; // 姓だけ（例: 松村）
}

/** 1人・1か月分の確定KPI（営業管理システムから取得） */
export interface MonthlyKpi {
  memberId: string;
  month: MonthKey;
  actions: number; // 行動数（＝商談数）
  gets: number; // GET数（＝契約数）
  points: number; // ポイント
  calls: number | null; // 打電数（null = データなし）
  contacts: number | null; // 接触数（null = データなし）
  appts: number | null; // アポ数（null = データなし）
  /** どの数字をどこから取ったかのメモ */
  sources: Record<string, string>;
}

/** 行動予定表の1行（商談・行動の1件） */
export interface Meeting {
  id: string;
  month: MonthKey;
  date: string; // 商談日 YYYY-MM-DD
  time: string;
  type: string; // 1次アポ / 2次アポ / 書類回収 など
  customerId: string;
  customerName: string;
  apoDate: string;
  apoStaff: string; // アポ担当
  salesStaff: string; // 営業担当
  zenkakuResult: string; // 前確結果
  apoKansan: string; // アポ換算
  method: string; // 営業方法（訪問 / WEB）
  done: string; // 行動完了
  result: string; // 商談結果（GET / 保留 など）
  points: string; // 獲得ポイント
  address: string; // 訪問住所
  actionResult: string; // 行動結果
  source: string; // 例: 行動予定表「①関西営業所」941行目
}

export type ContractKind = "契約" | "マイナス計上" | "過去案件の修正" | "メモ行";

/** 案件一覧の1行（契約案件） */
export interface Contract {
  id: string;
  month: MonthKey; // 計上した月（どの月の案件一覧に載っているか）
  orderMonth: number | null; // 受注月（Excel の値そのまま）
  orderDate: string; // 受注日
  recordDate: string; // 数値計上日
  customerName: string;
  apoStaff: string;
  salesStaff: string;
  team: string; // 計上チーム
  product: string; // 契約商品（備考の1行目）
  productCategories: string[]; // 商品の分類（集計用）
  amount: number | null; // 契約金額（確定したものだけ。要確認なら null）
  candidateAmount: number | null; // 備考から読み取った候補金額
  amountStatus: "確定" | "要確認";
  amountReason: string; // 要確認の理由
  points: number | null;
  discountCheck: string; // 値引きチェック
  memo: string; // 備考（元の文章）
  kind: ContractKind;
  flags: string[]; // 注意点（重複の可能性 など）
  source: string;
  isGet?: boolean; // 行動予定表の GET と一致したか（false = GET外の追加購入など）
  getMeeting?: string; // 一致した行動予定表の GET（日付・顧客名）
  // ↓ 管理者が画面で修正した場合に入る
  edited?: boolean;
  adminNote?: string;
  verified?: boolean;
}

export type IssueLevel = "データ不一致" | "要確認" | "参考";

export interface DataIssue {
  level: IssueLevel;
  memberId?: string;
  month?: MonthKey;
  title: string;
  detail: string;
}

export interface SourceFile {
  role: string;
  fileName: string;
  used: string; // 何に使ったか
}

/** npm run import で作られる data/dataset.json の中身 */
export interface Dataset {
  importedAt: string;
  months: MonthKey[];
  members: Member[];
  kpis: MonthlyKpi[];
  meetings: Meeting[];
  contracts: Contract[];
  issues: DataIssue[];
  sourceFiles: SourceFile[];
}

/** 画面から修正した内容（data/edits.json） */
export interface ContractEdit {
  amount?: number | null;
  product?: string;
  adminNote?: string;
  verified?: boolean;
  updatedAt: string;
}

export interface Edits {
  contracts: Record<string, ContractEdit>;
}
