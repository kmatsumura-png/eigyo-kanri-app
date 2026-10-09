"use client";
// 契約案件の一覧と、金額・商品などの修正画面
import { useRouter } from "next/navigation";
import { useState } from "react";
import { monthLabel } from "@/lib/config";
import { fmtDate, fmtYen } from "@/lib/format";
import type { Contract } from "@/lib/types";

type Filter = "all" | "pending" | "fixed" | "debit" | "other";

export default function ContractTable({ contracts, initialFilter = "all" }: { contracts: Contract[]; initialFilter?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [editing, setEditing] = useState<Contract | null>(null);
  const deals = contracts.filter((c) => c.kind === "契約");
  const others = contracts.filter((c) => c.kind !== "契約");
  const list =
    filter === "other"
      ? others
      : deals.filter(
          (c) =>
            filter === "all" ||
            (filter === "pending" ? c.amountStatus === "要確認" : filter === "debit" ? c.amountStatus === "口座振替" : c.amountStatus === "確定"),
        );

  const tabs: { k: Filter; label: string; n: number }[] = [
    { k: "all", label: "契約すべて", n: deals.length },
    { k: "fixed", label: "金額確定", n: deals.filter((c) => c.amountStatus === "確定").length },
    { k: "debit", label: "口座振替", n: deals.filter((c) => c.amountStatus === "口座振替").length },
    { k: "pending", label: "金額要確認", n: deals.filter((c) => c.amountStatus === "要確認").length },
    { k: "other", label: "マイナス計上・修正・メモ", n: others.length },
  ];

  return (
    <div data-snap-root>
      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            data-snap-btn={t.k}
            className={`shrink-0 rounded-md border px-3 py-1 text-sm ${filter === t.k ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:bg-bg"}`}
          >
            {t.label} <span className="num opacity-70">{t.n}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-4 text-sm text-ink-3">該当する案件はありません</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="num text-xs text-ink-3">{fmtDate(c.orderDate)}</span>
                  <span className="font-semibold">{c.customerName}</span>
                  {c.verified && <span className="rounded bg-[#e7f5e7] px-1.5 text-[11px] font-semibold text-good">確認済み</span>}
                  {c.edited && <span className="rounded bg-bg px-1.5 text-[11px] text-ink-2">手修正あり</span>}
                  {c.isGet === false && <span className="rounded bg-[#fdf3e1] px-1.5 text-[11px] font-semibold text-warn">GET外</span>}
                </div>
                <div className="truncate text-xs text-ink-2">{c.kind === "契約" ? c.product : c.kind}</div>
                <div className="text-xs text-ink-3">
                  営業:{c.salesStaff}・アポ:{c.apoStaff || "—"}・{c.points ?? "—"}pt・{monthLabel(c.month)}計上
                </div>
                {(c.amountReason || c.flags.length > 0 || c.adminNote) && (
                  <div className="mt-1 space-y-0.5 text-xs">
                    {c.amountReason && <div className="text-warn">⚠ {c.amountReason}</div>}
                    {c.flags.map((f) => (
                      <div key={f} className="text-warn">
                        ⚠ {f}
                      </div>
                    ))}
                    {c.adminNote && <div className="text-ink-2">📝 {c.adminNote}</div>}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="text-right">
                  {c.amountStatus === "確定" ? (
                    <>
                      <span className="num font-bold">{fmtYen(c.amount)}</span>
                      {c.amountBasis === "標準価格" && <div className="text-xs text-ink-3">標準価格（備考に金額なし）</div>}
                    </>
                  ) : c.amountStatus === "口座振替" ? (
                    <>
                      <span className="rounded bg-[#e8f0fb] px-1.5 py-0.5 text-xs font-semibold text-accent">口座振替</span>
                      <div className="text-xs text-ink-3">金額は計上しない</div>
                    </>
                  ) : (
                    <>
                      <span className="rounded bg-[#fdf3e1] px-1.5 py-0.5 text-xs font-semibold text-warn">金額要確認</span>
                      {c.candidateAmount !== null && <div className="num text-xs text-ink-3">候補 {fmtYen(c.candidateAmount)}</div>}
                    </>
                  )}
                </div>
                <button data-snap-hide onClick={() => setEditing(c)} className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 hover:bg-bg">
                  確認・修正
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <EditDialog c={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditDialog({ c, onClose }: { c: Contract; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(c.amount !== null ? String(c.amount) : "");
  const [product, setProduct] = useState(c.product);
  const [note, setNote] = useState(c.adminNote ?? "");
  const [verified, setVerified] = useState(!!c.verified);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const n = amount.trim() === "" ? null : Number(amount.replace(/[,，円\s]/g, ""));
    if (n !== null && !Number.isFinite(n)) {
      setError("契約金額は数字で入力してください（例：1300000）");
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/contracts/${encodeURIComponent(c.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: n, product, adminNote: note, verified }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("保存できませんでした。アプリが起動しているか確認してください。");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{c.customerName}</h3>
        <p className="mb-3 text-xs text-ink-3">{c.source}</p>
        <div className="mb-4 whitespace-pre-wrap rounded-lg bg-bg p-3 text-xs leading-relaxed text-ink-2">
          <div className="mb-1 font-semibold text-ink">元の備考</div>
          {c.memo || "（なし）"}
        </div>
        {c.kind === "契約" && (
          <>
            <label className="mb-1 block text-sm font-semibold">契約金額（最終販売価格・円）</label>
            <div className="mb-1 flex gap-2">
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="例：1300000"
                className="num w-full rounded-md border border-line px-3 py-2"
              />
              {c.candidateAmount !== null && amount === "" && (
                <button onClick={() => setAmount(String(c.candidateAmount))} className="shrink-0 rounded-md border border-line px-2 text-xs hover:bg-bg">
                  候補 {fmtYen(c.candidateAmount)} を入れる
                </button>
              )}
            </div>
            <p className="mb-3 text-xs text-ink-3">空欄のままなら「金額要確認」のままです。</p>
            <label className="mb-1 block text-sm font-semibold">契約商品</label>
            <input value={product} onChange={(e) => setProduct(e.target.value)} className="mb-3 w-full rounded-md border border-line px-3 py-2 text-sm" />
          </>
        )}
        <label className="mb-1 block text-sm font-semibold">備考（管理者メモ）</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mb-3 w-full rounded-md border border-line px-3 py-2 text-sm" />
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4" />
          データ確認済みにする
        </label>
        {error && <p className="mb-3 text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm hover:bg-bg">
            やめる
          </button>
          <button onClick={save} disabled={saving} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
