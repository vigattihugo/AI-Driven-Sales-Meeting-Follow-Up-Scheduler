import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function databasePathFromUrl(url: string): string {
  const value = url.replace(/^file:/, "");
  if (isAbsolute(value)) {
    return value;
  }

  return resolve(process.cwd(), "prisma", value);
}

export function ensureSqliteDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  const databasePath = databasePathFromUrl(databaseUrl);
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS "ProcessedEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "googleEventId" TEXT NOT NULL,
      "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedEvent_googleEventId_key"
      ON "ProcessedEvent"("googleEventId");

    CREATE TABLE IF NOT EXISTS "FollowUpApproval" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "googleEventId" TEXT NOT NULL,
      "contactEmail" TEXT NOT NULL,
      "meetingSummary" TEXT NOT NULL,
      "meetingStart" DATETIME NOT NULL,
      "meetingEnd" DATETIME NOT NULL,
      "meetingTimeZone" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "calendarEventId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "SuggestedSlot" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "approvalId" TEXT NOT NULL,
      "start" DATETIME NOT NULL,
      "end" DATETIME NOT NULL,
      "selected" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "SuggestedSlot_approvalId_fkey"
        FOREIGN KEY ("approvalId") REFERENCES "FollowUpApproval" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "SuggestedSlot_approvalId_idx"
      ON "SuggestedSlot"("approvalId");
  `);
  database.close();
}
