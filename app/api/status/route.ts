import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(integrationStatus()); }
