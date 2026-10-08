// ============================================================
// Excel 取り込みスクリプト
//
//   使い方:  excel フォルダに Excel を入れて  →  npm run import
//
// excel フォルダの Excel を読み込み、アプリ用のデータ
// data/dataset.json を作り直します。
// （画面で修正した内容 data/edits.json は消えません）
// ============================================================
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { MEMBERS, MONTHS, monthLabel } from "../lib/config";
import { parseAmount, productCategories } from "../lib/parse";
import type { Contract, ContractKind, DataIssue, Dataset, Meeting, MonthKey, MonthlyKpi, SourceFile } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");
const EXCEL_DIR = path.join(ROOT, "excel");
const OUT_FILE = path.join(ROOT, "data", "dataset.json");

type Row = unknown[];

const NAMES = MEMBERS.map((m) => m.name);
const idOf = (name: string) => MEMBERS.find((m) => m.name === name)?.id;

// ---------- 小さな道具 ----------
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,，]/g, ""));
  return Number.isFinite(n) ? n : null;
}
/** Excel の日付（シリアル値）を Date に変換 */
function excelDate(v: unknown): Date | null {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Math.round((v - 25569) * 86400000));
  }
  return null;
}
function ymd(v: unknown): string {
  const d = excelDate(v);
  return d ? d.toISOString().slice(0, 10) : str(v);
}
function monthOf(v: unknown): MonthKey | null {
  const d = excelDate(v);
  return d ? d.toISOString().slice(0, 7) : null;
}
function rows(wb: XLSX.WorkBook, sheet: string): Row[] {
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`シート「${sheet}」が見つかりません`);
  // 列・行の位置がずれないよう、必ず A1 セルから読む
  if (ws["!ref"]) {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    range.s = { r: 0, c: 0 };
    ws["!ref"] = XLSX.utils.encode_range(range);
  }
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: null, blankrows: true });
}
function readBook(file: string, sheets?: string[]): XLSX.WorkBook {
  return XLSX.read(fs.readFileSync(file), { type: "buffer", cellDates: false, sheets });
}

// ---------- 1. excel フォルダのファイルを探す ----------
function findFiles() {
  if (!fs.existsSync(EXCEL_DIR)) throw new Error("excel フォルダがありません");
  const files = fs.readdirSync(EXCEL_DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith("~$"));
  const pick = (re: RegExp, label: string) => {
    const hit = files.filter((f) => re.test(f.normalize("NFC")));
    if (hit.length === 0) throw new Error(`「${label}」の Excel が excel フォルダにありません`);
    if (hit.length > 1) throw new Error(`「${label}」の Excel が複数あります: ${hit.join(", ")}`);
    return path.join(EXCEL_DIR, hit[0]);
  };
  const monthly: Record<MonthKey, string> = {};
  for (const m of MONTHS) {
    const [y, mm] = m.split("-");
    monthly[m] = pick(new RegExp(`評価基準.*${y}年0?${Number(mm)}月`), `評価基準用数値集計 ${y}年${Number(mm)}月`);
  }
  return {
    system: pick(/営業管理システム/, "営業管理システム"),
    schedule: pick(/行動予定表/, "トップチーム行動予定表"),
    monthly,
  };
}

// ---------- 2. 営業管理システム（確定KPI） ----------
function readSystem(file: string) {
  const wb = readBook(file, ["月次実績（4月〜）", "集計DB", "履歴ログ"]);
  const result = new Map<string, Partial<MonthlyKpi>>();
  const key = (id: string, m: MonthKey) => `${id}|${m}`;

  // 月次実績（4月〜）: 氏名 / 年月 / 行動数 / GET数 / ポイント
  for (const r of rows(wb, "月次実績（4月〜）").slice(1)) {
    const id = idOf(str(r[0]));
    const m = monthOf(r[1]);
    if (!id || !m || !MONTHS.includes(m)) continue;
    result.set(key(id, m), {
      memberId: id,
      month: m,
      actions: num(r[2]) ?? 0,
      gets: num(r[3]) ?? 0,
      points: num(r[4]) ?? 0,
      sources: {
        行動数: "営業管理システム「月次実績（4月〜）」",
        GET数: "営業管理システム「月次実績（4月〜）」",
        ポイント: "営業管理システム「月次実績（4月〜）」",
      },
    });
  }

  // 集計DB: 現在の対象期間（取り込み時点では最新月）の詳細
  const db = rows(wb, "集計DB");
  const h = db[0].map(str);
  const col = (name: string) => {
    const i = h.indexOf(name);
    if (i < 0) throw new Error(`集計DB に「${name}」列がありません`);
    return i;
  };
  // 集計DB がどの月のデータかは「設定」シートの対象期間で判断
  const setting = rows(readBook(file, ["設定"]), "設定");
  const periodStart = setting.find((r) => str(r[0]) === "対象期間開始");
  const dbMonth = periodStart ? monthOf(periodStart[1]) : null;
  const dbRows = new Map<string, Row>();
  for (const r of db.slice(1)) {
    const id = idOf(str(r[col("氏名")]));
    if (id) dbRows.set(id, r);
  }

  // 履歴ログ: 月末時点の 打電数・アポ数 を取り出すために使う
  const hist = rows(wb, "履歴ログ").slice(1);

  return { result, key, dbMonth, dbRows, col, hist };
}

// ---------- 3. 評価基準用数値集計（月別） ----------
function readMonthly(file: string, month: MonthKey) {
  const wb = readBook(file, ["総合ランキング", "案件一覧"]);
  // 総合ランキング: 有料商材ポイント（照合用）
  const rank = rows(wb, "総合ランキング");
  const paidPoints = new Map<string, number>();
  for (const r of rank.slice(2, 20)) {
    const id = idOf(str(r[1]));
    const p = num(r[4]);
    if (id && p !== null) paidPoints.set(id, p);
  }

  // 案件一覧
  const sheet = rows(wb, "案件一覧");
  const headerIdx = sheet.findIndex((r) => str(r[0]) === "受注月");
  if (headerIdx < 0) throw new Error(`${path.basename(file)} の案件一覧に見出し行がありません`);
  const sheetMonthNum = Number(month.slice(5, 7));
  const used = new Map<string, number>();
  const uniqueId = (base: string) => {
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  };
  const contracts: Contract[] = [];
  sheet.slice(headerIdx + 1).forEach((r, i) => {
    const rowNo = headerIdx + 2 + i;
    const sales = str(r[5]);
    if (!NAMES.includes(sales)) return; // 対象の5人以外は取り込まない
    const memo = str(r[11]);
    const product = memo.split(/\r?\n/)[0].trim();
    const points = num(r[7]);
    const orderMonth = num(r[0]);
    const discountCheck = str(r[10]);
    const flags: string[] = [];

    let kind: ContractKind = "契約";
    if (points === null) kind = "メモ行";
    else if (points < 0) kind = "マイナス計上";
    else if (orderMonth === null || (orderMonth !== sheetMonthNum && orderMonth !== sheetMonthNum - 1)) kind = "過去案件の修正";
    else if (orderMonth === sheetMonthNum - 1) flags.push(`受注月(${orderMonth}月)と計上月(${sheetMonthNum}月)が違います`);

    const amt =
      kind === "契約"
        ? parseAmount(memo, product, discountCheck)
        : {
            amount: null,
            candidate: null,
            status: "要確認" as const,
            reason:
              kind === "マイナス計上"
                ? "マイナス計上のため、契約金額に含めていません"
                : kind === "過去案件の修正"
                  ? "過去案件の修正のため、契約金額に含めていません"
                  : "ポイントの記載がない行です（メモ・確認用の行の可能性）",
          };

    contracts.push({
      // Excel の行がずれても修正内容が消えないよう、行番号ではなく中身から ID を作る
      id: uniqueId(`${month}_${ymd(r[1])}_${str(r[3])}_${sales}_${product || kind}`.replace(/\s+/g, "")),
      month,
      orderMonth,
      orderDate: ymd(r[1]),
      recordDate: ymd(r[9]),
      customerName: str(r[3]),
      apoStaff: str(r[4]),
      salesStaff: sales,
      team: str(r[6]),
      product: kind === "契約" ? product : "",
      productCategories: kind === "契約" ? productCategories(product) : [],
      amount: amt.amount,
      candidateAmount: amt.candidate,
      amountStatus: amt.status,
      amountReason: amt.reason,
      points,
      discountCheck,
      memo,
      kind,
      flags,
      source: `評価基準用数値集計 ${monthLabel(month)}「案件一覧」${rowNo}行目`,
    });
  });
  return { paidPoints, contracts };
}

// ---------- 4. 行動予定表（商談の明細） ----------
function readSchedule(file: string): Meeting[] {
  const wb = readBook(file);
  const out: Meeting[] = [];
  const first = new Date(`${MONTHS[0]}-01T00:00:00Z`).getTime();
  const lastM = MONTHS[MONTHS.length - 1];
  const end = new Date(Date.UTC(Number(lastM.slice(0, 4)), Number(lastM.slice(5, 7)), 1)).getTime();

  for (const sheetName of wb.SheetNames) {
    const sheet = rows(wb, sheetName);
    // 見出し行（「顧客ID」がある行）を探し、列の位置を自動で判断
    const hIdx = sheet.findIndex((r) => r.some((v) => str(v) === "顧客ID"));
    if (hIdx < 0) continue;
    const h = sheet[hIdx].map((v) => str(v).replace(/\s+/g, ""));
    const c = (name: string) => {
      const exact = h.indexOf(name);
      return exact >= 0 ? exact : h.findIndex((v) => v.startsWith(name));
    };
    const idCol = c("顧客ID");
    const typeCol = idCol - 1; // 顧客IDの左の列に「1次アポ」などが入っている
    const C = {
      name: c("顧客名"),
      apoDate: c("アポ日"),
      date: c("商談日"),
      time: c("商談時間"),
      apo: c("アポ"),
      sales: c("営業"),
      zk: c("前確結果"),
      kansan: c("アポ換算"),
      method: c("営業方法"),
      done: c("行動完了"),
      result: c("商談結果"),
      pt: c("獲得P"),
      addr: c("訪問住所"),
      act: c("行動結果"),
    };
    sheet.slice(hIdx + 1).forEach((r, i) => {
      const d = excelDate(r[C.date]);
      if (!d || d.getTime() < first || d.getTime() >= end) return;
      const sales = str(r[C.sales]);
      const apo = str(r[C.apo]);
      if (!NAMES.includes(sales) && !NAMES.includes(apo)) return;
      if (!str(r[C.name]) && !str(r[idCol])) return;
      const rowNo = hIdx + 2 + i;
      out.push({
        id: `${sheetName}-${rowNo}`,
        month: d.toISOString().slice(0, 7),
        date: d.toISOString().slice(0, 10),
        time: str(r[C.time]),
        type: str(r[typeCol]),
        customerId: str(r[idCol]),
        customerName: str(r[C.name]),
        apoDate: ymd(r[C.apoDate]),
        apoStaff: apo,
        salesStaff: sales,
        zenkakuResult: str(r[C.zk]),
        apoKansan: str(r[C.kansan]),
        method: str(r[C.method]),
        done: str(r[C.done]),
        result: str(r[C.result]),
        points: C.pt >= 0 ? str(r[C.pt]) : "",
        address: str(r[C.addr]),
        actionResult: C.act >= 0 ? str(r[C.act]) : "",
        source: `行動予定表「${sheetName}」${rowNo}行目`,
      });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

// ---------- メイン ----------
function main() {
  const files = findFiles();
  console.log("読み込むファイル:");
  console.log("  営業管理システム :", path.basename(files.system));
  console.log("  行動予定表       :", path.basename(files.schedule));
  for (const m of MONTHS) console.log(`  評価基準 ${monthLabel(m)}      :`, path.basename(files.monthly[m]));

  const issues: DataIssue[] = [];
  const sys = readSystem(files.system);

  // 集計DB（最新月）を月次実績に足す。両方にあれば一致するか確認
  if (sys.dbMonth && MONTHS.includes(sys.dbMonth)) {
    for (const [id, r] of sys.dbRows) {
      const k = sys.key(id, sys.dbMonth);
      const db = {
        actions: num(r[sys.col("行動数")]) ?? 0,
        gets: num(r[sys.col("GET数")]) ?? 0,
        points: num(r[sys.col("ポイント")]) ?? 0,
      };
      const existing = sys.result.get(k);
      if (existing) {
        for (const f of ["actions", "gets", "points"] as const) {
          if (existing[f] !== db[f]) {
            issues.push({
              level: "データ不一致",
              memberId: id,
              month: sys.dbMonth,
              title: `${f === "actions" ? "行動数" : f === "gets" ? "GET数" : "ポイント"}が「月次実績」と「集計DB」で違います`,
              detail: `月次実績: ${existing[f]} ／ 集計DB: ${db[f]}。月次実績の値を使っています。`,
            });
          }
        }
      } else {
        const src = "営業管理システム「集計DB」（最終同期時点）";
        sys.result.set(k, { memberId: id, month: sys.dbMonth, ...db, sources: { 行動数: src, GET数: src, ポイント: src } });
      }
      const cur = sys.result.get(k)!;
      cur.calls = num(r[sys.col("打電数")]);
      cur.contacts = num(r[sys.col("接触数")]);
      cur.appts = num(r[sys.col("アポ数")]);
      Object.assign(cur.sources!, {
        打電数: "営業管理システム「集計DB」",
        接触数: "営業管理システム「集計DB」",
        アポ数: "営業管理システム「集計DB」",
      });
    }
  }

  // 過去の月の 打電数・アポ数 は「履歴ログ」の月末記録から取る。
  // 行動数・GET数・ポイントが確定値と一致する記録のうち、その月の最後のものを使う。
  for (const kpi of sys.result.values()) {
    if (kpi.calls !== undefined) continue;
    const name = MEMBERS.find((m) => m.id === kpi.memberId)!.name;
    const [y, mm] = kpi.month!.split("-").map(Number);
    const from = Date.UTC(y, mm - 1, 1);
    const to = Date.UTC(y, mm, 1);
    let best: Row | null = null;
    for (const r of sys.hist) {
      if (str(r[0]) !== name) continue;
      const d = excelDate(r[1]);
      if (!d || d.getTime() < from || d.getTime() >= to) continue;
      if (num(r[3]) === kpi.actions && num(r[5]) === kpi.gets && num(r[6]) === kpi.points) best = r;
    }
    if (best) {
      kpi.calls = num(best[2]);
      kpi.appts = num(best[4]);
      const at = excelDate(best[1])!.toISOString().slice(0, 16).replace("T", " ");
      Object.assign(kpi.sources!, {
        打電数: `営業管理システム「履歴ログ」の月末記録（${at} 時点）`,
        アポ数: `営業管理システム「履歴ログ」の月末記録（${at} 時点）`,
      });
    } else {
      kpi.calls = null;
      kpi.appts = null;
      issues.push({
        level: "要確認",
        memberId: kpi.memberId,
        month: kpi.month,
        title: "打電数・アポ数が取得できませんでした",
        detail: "履歴ログに、確定値（行動数・GET数・ポイント）と一致する月末記録がありません。",
      });
    }
    kpi.contacts = null;
    kpi.sources!["接触数"] = "元データなし（接触数は最新月の集計DBにしかありません）";
  }

  // 抜けている月がないか確認
  const kpis: MonthlyKpi[] = [];
  for (const m of MONTHS) {
    for (const mem of MEMBERS) {
      const k = sys.result.get(sys.key(mem.id, m));
      if (!k) {
        issues.push({
          level: "要確認",
          memberId: mem.id,
          month: m,
          title: "確定KPIがありません",
          detail: "営業管理システムの「月次実績」にも「集計DB」にもこの月のデータがありません。0として表示しています。",
        });
        kpis.push({ memberId: mem.id, month: m, actions: 0, gets: 0, points: 0, calls: null, contacts: null, appts: null, sources: {} });
      } else kpis.push(k as MonthlyKpi);
    }
  }

  // 月別の評価基準ファイル
  const contracts: Contract[] = [];
  for (const m of MONTHS) {
    const mon = readMonthly(files.monthly[m], m);
    contracts.push(...mon.contracts);
    for (const mem of MEMBERS) {
      const k = kpis.find((x) => x.memberId === mem.id && x.month === m)!;
      const paid = mon.paidPoints.get(mem.id);
      const rowsOf = mon.contracts.filter((c) => c.salesStaff === mem.name);
      const plus = rowsOf.filter((c) => c.kind === "契約").reduce((s, c) => s + (c.points ?? 0), 0);
      const other = rowsOf.filter((c) => c.kind !== "契約").reduce((s, c) => s + (c.points ?? 0), 0);
      if (paid !== undefined && paid !== k.points) {
        issues.push({
          level: "データ不一致",
          memberId: mem.id,
          month: m,
          title: "ポイントが「営業管理システム」と「評価基準用数値集計」で違います",
          detail: `営業管理システム: ${k.points}pt ／ 評価基準「総合ランキング」の有料商材ポイント: ${paid}pt。参考：案件一覧のプラス計上 ${plus}pt、マイナス計上・過去案件の修正 ${other > 0 ? "+" : ""}${other}pt。アプリでは営業管理システムの値を使っています。`,
        });
      }
      const n = rowsOf.filter((c) => c.kind === "契約").length;
      if (n !== k.gets) {
        issues.push({
          level: "参考",
          memberId: mem.id,
          month: m,
          title: "GET数と案件一覧の契約行数が違います",
          detail: `GET数（営業管理システム）: ${k.gets}件 ／ 案件一覧の契約行: ${n}件。追加購入などで1回のGETが複数行になっている可能性があります。契約数はGET数を使っています。`,
        });
      }
    }
  }

  // 重複の可能性（同じ顧客・同じ商品・同じ担当）
  const seen = new Map<string, Contract[]>();
  for (const c of contracts.filter((c) => c.kind === "契約")) {
    const k = `${c.customerName}|${c.product}|${c.salesStaff}`;
    seen.set(k, [...(seen.get(k) ?? []), c]);
  }
  for (const list of seen.values()) {
    if (list.length < 2) continue;
    for (const c of list) {
      c.flags.push("同じ顧客・同じ商品の案件が他にもあります（重複でないか確認）");
      c.amountStatus = "要確認";
      if (c.amount !== null) c.candidateAmount = c.amount;
      c.amount = null;
      c.amountReason = c.amountReason || "重複の可能性があるため確認してください";
    }
    issues.push({
      level: "要確認",
      memberId: idOf(list[0].salesStaff),
      title: `重複の可能性：${list[0].customerName}`,
      detail: `同じ顧客・同じ商品の行が ${list.length} 件あります（${list.map((c) => c.source).join("、")}）。`,
    });
  }

  // 行動予定表
  const meetings = readSchedule(files.schedule);
  for (const m of MONTHS) {
    for (const mem of MEMBERS) {
      const k = kpis.find((x) => x.memberId === mem.id && x.month === m)!;
      const getRows = meetings.filter((x) => x.month === m && x.salesStaff === mem.name && x.result === "GET").length;
      if (getRows !== k.gets) {
        issues.push({
          level: "参考",
          memberId: mem.id,
          month: m,
          title: "行動予定表のGET件数と確定GET数が違います",
          detail: `確定GET数: ${k.gets}件 ／ 行動予定表で商談結果が「GET」の行: ${getRows}件。行動予定表は商談の明細確認用で、数字の集計には使っていません。`,
        });
      }
    }
  }

  const sourceFiles: SourceFile[] = [
    {
      role: "① 確定KPI（最優先）",
      fileName: path.basename(files.system),
      used: `「月次実績（4月〜）」→ 行動数・GET数・ポイント（過去月）／「集計DB」→ ${sys.dbMonth ? monthLabel(sys.dbMonth) : "最新月"}の全項目（打電数・接触数・アポ数など）／「履歴ログ」→ 過去月の打電数・アポ数（月末記録）`,
    },
    ...MONTHS.map((m) => ({
      role: `② 評価基準 ${monthLabel(m)}`,
      fileName: path.basename(files.monthly[m]),
      used: "「案件一覧」→ 契約案件・契約商品・契約金額（最終販売価格）・ポイント／「総合ランキング」→ ポイントの照合用",
    })),
    {
      role: "③ 商談の明細",
      fileName: path.basename(files.schedule),
      used: "全シート → 商談日・顧客・アポ担当・営業担当・前確結果・商談結果など（明細表示用。集計には使っていません）",
    },
  ];

  const dataset: Dataset = {
    importedAt: new Date().toISOString(),
    months: MONTHS,
    members: MEMBERS,
    kpis,
    meetings,
    contracts,
    issues,
    sourceFiles,
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(dataset, null, 1));

  console.log("\n✅ 取り込み完了 → data/dataset.json");
  console.log(`  KPI: ${kpis.length}件 / 商談明細: ${meetings.length}件 / 案件: ${contracts.length}件`);
  console.log(`  金額要確認: ${contracts.filter((c) => c.amountStatus === "要確認" && c.kind === "契約").length}件`);
  console.log(`  データ不一致: ${issues.filter((i) => i.level === "データ不一致").length}件 / 要確認: ${issues.filter((i) => i.level === "要確認").length}件`);
}

try {
  main();
} catch (e) {
  console.error("\n❌ 取り込みに失敗しました:", e instanceof Error ? e.message : e);
  process.exit(1);
}
