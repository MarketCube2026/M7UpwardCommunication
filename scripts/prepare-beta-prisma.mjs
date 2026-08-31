import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve("prisma/schema.prisma");
const outputDir = path.resolve(".beta-prisma");
const outputPath = path.join(outputDir, "schema.prisma");
const source = await readFile(sourcePath, "utf8");
const schema = source
  .replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace(
    'url      = env("DATABASE_URL")',
    'url       = env("DATABASE_URL")\n  directUrl = env("DATABASE_URL_UNPOOLED")',
  );
if (schema === source) throw new Error("Unable to locate SQLite provider in Prisma schema");
if (!schema.includes('directUrl = env("DATABASE_URL_UNPOOLED")')) {
  throw new Error("Unable to add the Neon direct connection URL to Prisma schema");
}
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, schema, "utf8");
console.log("Prepared isolated PostgreSQL Prisma schema for public beta.");
