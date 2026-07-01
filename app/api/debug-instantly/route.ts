import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const id = "9e015ca5-dcf1-48f1-ae1a-3e31f87f815a";
  const h = { Authorization: `Bearer ${process.env.INSTANTLY_API_KEY || ""}`, "User-Agent": "curl/8.4.0", Accept: "application/json" };
  const url = `https://api.instantly.ai/api/v2/campaigns/analytics/overview?id=${id}`;
  const out: any = { keyLen: (process.env.INSTANTLY_API_KEY || "").length };
  try {
    const res = await fetch(url, { headers: h, cache: "no-store" });
    out.status = res.status;
    const text = await res.text();
    out.bodyPreview = text.slice(0, 600);
  } catch (e: any) { out.error = String(e?.message ?? e); }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
