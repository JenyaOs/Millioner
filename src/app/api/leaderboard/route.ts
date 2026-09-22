```ts
import { db } from "@/db";
import { gameResults } from "@/db/schema";
import { asc, desc, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const validTracks = new Set(["business", "system", "data", "ml"]);

export async function GET() {
  try {
    /*
     * Для каждого игрока выбираем только его лучший результат:
     *
     * 1. Максимальный score
     * 2. Если score одинаковый — минимальное время
     * 3. Если и время одинаковое — более ранний результат
     *
     * DISTINCT ON работает в PostgreSQL.
     */
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (player_name)
        id,
        player_name,
        track,
        score,
        question_reached,
        duration_seconds,
        created_at
      FROM game_results
      ORDER BY
        player_name,
        score DESC,
        duration_seconds ASC,
        created_at ASC
    `);

    /*
     * DISTINCT ON сначала группирует записи по player_name,
     * поэтому дополнительно сортируем уже готовый результат
     * для отображения таблицы лидеров.
     */
    const leaderboard = rows.rows
      .sort((a, b) => {
        const scoreDiff = Number(b.score) - Number(a.score);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return (
          Number(a.duration_seconds) -
          Number(b.duration_seconds)
        );
      })
      .slice(0, 50)
      .map((row, index) => ({
        place: index + 1,
        id: row.id,
        playerName: row.player_name,
        track: row.track,
        score: Number(row.score),
        questionReached: Number(row.question_reached),
        durationSeconds: Number(row.duration_seconds),
        createdAt: row.created_at,
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
```
