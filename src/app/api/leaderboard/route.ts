import { db } from "@/db";
import { gameResults } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const validTracks = new Set(["business", "system", "data", "ml"]);

export async function GET() {
  try {
    const rankedResults = db
      .select({
        id: gameResults.id,
        playerName: gameResults.playerName,
        track: gameResults.track,
        score: gameResults.score,
        questionReached: gameResults.questionReached,
        durationSeconds: gameResults.durationSeconds,
        createdAt: gameResults.createdAt,
        playerRank: sql<number>`row_number() over (
          partition by lower(trim(${gameResults.playerName}))
          order by ${gameResults.score} desc, ${gameResults.durationSeconds} asc, ${gameResults.createdAt} desc
        )`.as("player_rank"),
      })
      .from(gameResults)
      .as("ranked_results");

    const rows = await db
      .select({
        id: rankedResults.id,
        playerName: rankedResults.playerName,
        track: rankedResults.track,
        score: rankedResults.score,
        questionReached: rankedResults.questionReached,
        durationSeconds: rankedResults.durationSeconds,
        createdAt: rankedResults.createdAt,
      })
      .from(rankedResults)
      .where(eq(rankedResults.playerRank, 1))
      .orderBy(desc(rankedResults.score), asc(rankedResults.durationSeconds))
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
