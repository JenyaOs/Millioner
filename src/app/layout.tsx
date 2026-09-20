import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "S7 Analyst Challenge — игра для аналитиков",
  description: "15 вопросов для бизнес-, системных, дата-аналитиков и ML-инженеров.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
