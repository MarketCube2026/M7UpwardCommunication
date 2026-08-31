import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const orphanCounts = {
    supervisors: await prisma.supervisor.count({ where: { userId: null } }),
    rehearsals: await prisma.rehearsal.count({ where: { userId: null } }),
    debriefs: await prisma.debrief.count({ where: { userId: null } }),
  };
  if (Object.values(orphanCounts).some(Boolean)) throw new Error(`仍有未归属数据：${JSON.stringify(orphanCounts)}`);
  console.log("Commercial database ownership check passed.");
}
main().finally(() => prisma.$disconnect());
