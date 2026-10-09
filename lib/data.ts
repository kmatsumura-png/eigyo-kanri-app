// ============================================================
// データを読み込むところ（サーバー側だけで動きます）
//   data/dataset.json … Excel から作ったデータ（npm run import で作成）
//   data/edits.json   … 画面で修正した内容
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { productCategories } from "./parse";
import type { Contract, ContractEdit, Dataset, Edits } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATASET_FILE = path.join(DATA_DIR, "dataset.json");
const EDITS_FILE = path.join(DATA_DIR, "edits.json");

export function loadEdits(): Edits {
  try {
    return JSON.parse(fs.readFileSync(EDITS_FILE, "utf8")) as Edits;
  } catch {
    return { contracts: {} };
  }
}

export function saveContractEdit(id: string, edit: Omit<ContractEdit, "updatedAt">) {
  const edits = loadEdits();
  edits.contracts[id] = { ...edits.contracts[id], ...edit, updatedAt: new Date().toISOString() };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(EDITS_FILE, JSON.stringify(edits, null, 2));
}

function applyEdit(c: Contract, e: ContractEdit | undefined): Contract {
  if (!e) return c;
  const out: Contract = { ...c, edited: true, verified: e.verified, adminNote: e.adminNote };
  if (e.product !== undefined && e.product !== "") {
    out.product = e.product;
    out.productCategories = productCategories(e.product);
  }
  if (e.amount !== undefined && e.amount !== null) {
    out.amount = e.amount;
    out.amountStatus = "確定";
    out.amountBasis = undefined;
    out.amountReason = "";
  }
  return out;
}

/** dataset.json を読み、画面での修正を反映して返す。まだ取り込んでいなければ null */
export function getData(): Dataset | null {
  if (!fs.existsSync(DATASET_FILE)) return null;
  const ds = JSON.parse(fs.readFileSync(DATASET_FILE, "utf8")) as Dataset;
  const edits = loadEdits();
  ds.contracts = ds.contracts.map((c) => applyEdit(c, edits.contracts[c.id]));
  return ds;
}
