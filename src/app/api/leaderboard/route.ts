import { db } from "@/db";
import { gameResults } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const validTracks = new Set(["business", "system", "data", "ml"]);

export async function GET() {
  try {
    // Забираем результаты в нужном порядке.
    // Для каждого игрока оставляем только первый результат.
    const rows = await db
      .select()
      .from(gameResults)
      .orderBy(
        desc(gameResults.score),
        asc(gameResults.durationSeconds),
        asc(gameResults.createdAt),
      );

    const uniquePlayers = new Map<string, (typeof rows)[number]>();

    for (const row of rows) {
      const playerKey = row.playerName.trim().toLowerCase();

      if (!uniquePlayers.has(playerKey)) {
        uniquePlayers.set(playerKey, row);
      }
    }

    const leaderboard = Array.from(uniquePlayers.values())
      .slice(0, 50)
      .map((row, index) => ({
        place: index + 1,
        id: row.id,
        playerName: row.playerName,
        track: row.track,
        score: row.score,
        questionReached: row.questionReached,
        durationSeconds: row.durationSeconds,
        createdAt: row.createdAt,
      }));

    return Response.json(leaderboard);
  } catch (error) {
    console.error("LEADERBOARD GET ERROR:", error);

    return Response.json(
      {
        error: "Ошибка БД",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const playerName = String(body.playerName ?? "")
      .trim()
      .slice(0, 32);

    const track = String(body.track ?? "");

    const score = Math.max(
      0,
      Math.min(1000, Number(body.score) || 0),
    );

    const questionReached = Math.max(
      0,
      Math.min(15, Number(body.questionReached) || 0),
    );

    const durationSeconds = Math.max(
      0,
      Math.min(900, Number(body.durationSeconds) || 0),
    );

    if (playerName.length < 2 || !validTracks.has(track)) {
      return Response.json(
        { error: "Некорректные данные" },
        { status: 400 },
      );
    }

    const [result] = await db
      .insert(gameResults)
      .values({
        playerName,
        track,
        score,
        questionReached,
        durationSeconds,
      })
      .returning();

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("LEADERBOARD POST ERROR:", error);

    return Response.json(
      {
        error: "Не удалось сохранить результат",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
