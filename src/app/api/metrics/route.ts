import { NextResponse } from "next/server";
import { requireApiAction, handleApiError } from "@/lib/api";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

// GET /api/metrics — dashboard aggregates (staff only).
export async function GET() {
  try {
    await requireApiAction("dashboard.view");
    const metrics = await getMetrics();
    return NextResponse.json(metrics);
  } catch (e) {
    return handleApiError(e);
  }
}
