import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const scenarios = [
    ["周报汇报", "在有限时间内清晰同步进展、风险与下一步。"],
    ["项目延期说明", "解释延期原因，同时给出可控的补救方案。"],
    ["请求资源", "用事实和收益说明为什么需要额外资源。"],
    ["提出新方案", "推动一个新想法获得试点和决策支持。"],
    ["反馈问题", "及时暴露问题，守住关系并推动解决。"],
  ];
  for (const [name, description] of scenarios) {
    await prisma.scenario.upsert({ where: { id: `builtin-${name}` }, update: {}, create: { id: `builtin-${name}`, name, description, builtin: true } });
  }
}

main().finally(() => prisma.$disconnect());
