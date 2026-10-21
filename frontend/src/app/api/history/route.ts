import { NextResponse } from "next/server";

import { getServerSupabase, hasServerSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Read-only: daily precipitation for the rain heat map. Does not touch the model or registry.
export async function GET() {
  if (!hasServerSupabaseConfig()) {
    return NextResponse.json({ days: [], error: "Supabase is not configured." }, { status: 503 });
  }
  try {
    const { data, error } = await getServerSupabase()
      .from("weather_features")
      .select("date, precipitation_sum")
      .order("date", { ascending: false })
      .limit(365);
    if (error) {
      throw new Error(error.message);
    }
    const days = (data ?? [])
      .map((row) => ({ date: String(row.date), precipitation: Number(row.precipitation_sum ?? 0) }))
      .reverse();
    return NextResponse.json({ days });
  } catch (err) {
    return NextResponse.json(
      { days: [], error: err instanceof Error ? err.message : "Unable to load history." },
      { status: 500 },
    );
  }
}
