import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const gameResults = pgTable("game_results", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  track: text("track").notNull(),
  score: integer("score").notNull(),
  questionReached: integer("question_reached").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type GameResult = typeof gameResults.$inferSelect;
