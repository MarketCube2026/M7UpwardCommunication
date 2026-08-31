import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statements = [
  `CREATE TABLE IF NOT EXISTS "Supervisor" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "position" TEXT, "relation" TEXT, "tags" TEXT NOT NULL DEFAULT '[]', "communicationPrefs" TEXT NOT NULL DEFAULT '{}', "workStyle" TEXT NOT NULL DEFAULT '{}', "taboos" TEXT, "notes" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "Scenario" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "builtin" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS "Rehearsal" ("id" TEXT NOT NULL PRIMARY KEY, "supervisorId" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "scenarioName" TEXT NOT NULL, "supervisorSnapshot" TEXT NOT NULL, "inputText" TEXT NOT NULL, "actionPlan" TEXT, "evaluation" TEXT NOT NULL, "mode" TEXT NOT NULL DEFAULT 'demo', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Rehearsal_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Rehearsal_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Debrief" ("id" TEXT NOT NULL PRIMARY KEY, "rehearsalId" TEXT NOT NULL UNIQUE, "outcome" TEXT NOT NULL, "rating" INTEGER, "variance" TEXT, "nextAction" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Debrief_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "Rehearsal_supervisorId_idx" ON "Rehearsal" ("supervisorId")`,
];

async function main() {
  for (const sql of statements) await prisma.$executeRawUnsafe(sql);
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Scenario")`);
  if (!columns.some((column) => column.name === "referenceTemplate")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Scenario" ADD COLUMN "referenceTemplate" TEXT`);
  }
}
main().finally(() => prisma.$disconnect());
