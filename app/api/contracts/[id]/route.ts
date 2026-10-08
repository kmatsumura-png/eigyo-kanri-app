// 契約案件の修正を保存する窓口（data/edits.json に書き込みます）
import { NextResponse } from "next/server";
import { getData, saveContractEdit } from "@/lib/data";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ds = getData();
  if (!ds?.contracts.some((c) => c.id === id)) {
    return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
  }
  const body = (await req.json()) as { amount?: unknown; product?: unknown; adminNote?: unknown; verified?: unknown };
  const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? body.amount : null;
  saveContractEdit(id, {
    amount,
    product: typeof body.product === "string" ? body.product.trim() : undefined,
    adminNote: typeof body.adminNote === "string" ? body.adminNote.trim() : undefined,
    verified: body.verified === true,
  });
  return NextResponse.json({ ok: true });
}
