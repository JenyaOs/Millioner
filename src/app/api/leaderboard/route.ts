import { db } from "@/db";
import { gameResults } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const validTracks = new Set(["business", "system", "data", "ml"]);

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(gameResults)
      .orderBy(desc(gameResults.score), asc(gameResults.durationSeconds))
      .limit(50);
    return Response.json(rows);
  } catch {
    return Response.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const playerName = String(body.playerName ?? "").trim().slice(0, 32);
    const track = String(body.track ?? "");
    const score = Math.max(0, Math.min(1000, Number(body.score) || 0));
    const questionReached = Math.max(0, Math.min(15, Number(body.questionReached) || 0));
    const durationSeconds = Math.max(0, Math.min(900, Number(body.durationSeconds) || 0));

    if (playerName.length < 2 || !validTracks.has(track)) {
      return Response.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const [result] = await db
      .insert(gameResults)
      .values({ playerName, track, score, questionReached, durationSeconds })
      .returning();
    return Response.json(result, { status: 201 });
  } catch {
    return Response.json({ error: "Не удалось сохранить результат" }, { status: 500 });
  }
}
