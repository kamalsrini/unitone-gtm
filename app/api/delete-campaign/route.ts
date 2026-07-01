import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { authorizedCron } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function run(req: Request) {
  if (!authorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { rows } = await sql`SELECT config FROM campaigns WHERE id=${id}`;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Safety: never delete an Instantly-linked (real) campaign via this route.
  if ((rows[0].config as any)?.instantly_campaign_id) {
    return NextResponse.json({ error: "refusing to delete an Instantly-linked campaign" }, { status: 400 });
  }
  await sql`DELETE FROM campaigns WHERE id=${id}`; // cascades to accounts/signals/contacts/messages/events
  return NextResponse.json({ ok: true, deleted: id });
}
export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
