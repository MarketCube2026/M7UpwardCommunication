import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoPhone = process.env.DEMO_PHONE || "+8613800000000";
  const demo = await prisma.user.upsert({ where: { phone: demoPhone }, update: {}, create: { phone: demoPhone, nickname: "演示用户" } });
  await prisma.user.upsert({ where: { phone: "+8613900000000" }, update: {}, create: { phone: "+8613900000000", nickname: "隔离测试用户" } });

  const packages = [
    { code: "trial-20", name: "尝鲜", credits: 20, priceFen: 300, description: "低价入门", position: "低价入门", sortOrder: 1 },
    { code: "regular-100", name: "常用", credits: 100, priceFen: 1000, description: "主力套餐", position: "主力套餐", sortOrder: 2 },
    { code: "value-1000", name: "超值", credits: 1000, priceFen: 2000, description: "锁定重度用户", position: "锁定重度用户", sortOrder: 3 },
  ];
  for (const item of packages) await prisma.package.upsert({ where: { code: item.code }, update: item, create: item });

  const settings = { dailyFreeLimit: "3", timezone: "Asia/Shanghai", smsSignature: "知彼", tokenCostPerMillionFen: "0" };
  for (const [key, value] of Object.entries(settings)) await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value } });

  const scenarios = [
    ["周报汇报", "在有限时间内清晰同步进展、风险与下一步。"], ["项目延期说明", "解释延期原因，同时给出可控的补救方案。"],
    ["请求资源", "用事实和收益说明为什么需要额外资源。"], ["提出新方案", "推动一个新想法获得试点和决策支持。"], ["反馈问题", "及时暴露问题，守住关系并推动解决。"],
  ];
  for (const [name, description] of scenarios) await prisma.scenario.upsert({ where: { id: `builtin-${name}` }, update: { active: true }, create: { id: `builtin-${name}`, name, description, builtin: true } });

  for (const [index, label] of ["结果导向", "注重细节", "风险敏感", "重视数据", "逻辑清晰", "亲和力强"].entries()) await prisma.personalityTag.upsert({ where: { label }, update: {}, create: { label, sortOrder: index } });
  for (const [index, content] of ["先讲结论，再讲过程。", "把风险说早一点，也把方案带上。", "下一步要有负责人、时间和验证方式。"].entries()) {
    const existing = await prisma.dailyTip.findFirst({ where: { content } });
    if (!existing) await prisma.dailyTip.create({ data: { content, sortOrder: index } });
  }

  await prisma.supervisor.updateMany({ where: { userId: null }, data: { userId: demo.id } });
  await prisma.scenario.updateMany({ where: { ownerUserId: null, builtin: false }, data: { ownerUserId: demo.id } });
  await prisma.rehearsal.updateMany({ where: { userId: null }, data: { userId: demo.id } });
  await prisma.debrief.updateMany({ where: { userId: null }, data: { userId: demo.id } });

  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (adminUsername && adminPassword) {
    const passwordHash = await hash(adminPassword, 12);
    await prisma.adminAccount.upsert({ where: { username: adminUsername }, update: { passwordHash, status: "ACTIVE" }, create: { username: adminUsername, passwordHash } });
  }
}

main().finally(() => prisma.$disconnect());
