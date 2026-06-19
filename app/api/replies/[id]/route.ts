import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await sql`UPDATE replies SET handled=${body.handled ?? true} WHERE id=${Number(id)}`;
  return NextResponse.json({ ok: true });
}
