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
    { code: "value-1000", name: "超值", credits: 1000, priceFen: 5000, description: "锁定重度用户", position: "锁定重度用户", sortOrder: 3 },
  ];
  for (const item of packages) await prisma.package.upsert({ where: { code: item.code }, update: item, create: item });

  const settings = { dailyFreeLimit: "3", timezone: "Asia/Shanghai", smsSignature: "知彼", tokenCostPerMillionFen: "0" };
  for (const [key, value] of Object.entries(settings)) await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value } });

  const scenarios = [
    { name: "周报汇报", description: "在有限时间内清晰同步进展、风险与下一步。", referenceTemplate: "结论：本周进展与建议。\n关键事实：目标、数据、完成情况。\n风险与影响：需要关注的问题。\n下一步：负责人、时间点、验证方式。\n需要领导决定：明确希望获得的确认或资源。", sortOrder: 1 },
    { name: "项目延期说明", description: "解释延期原因，同时给出可控的补救方案。", referenceTemplate: "结论：项目将延期至何时，建议采取什么补救动作。\n事实：延期原因和已核实证据。\n影响：范围、客户、交付与风险。\n方案：补救计划、取舍与责任人。\n需要支持：希望领导确认的优先级或资源。", sortOrder: 2 },
    { name: "请求资源", description: "用事实和收益说明为什么需要额外资源。", referenceTemplate: "结论：申请什么资源、持续多久、用于什么目标。\n依据：当前数据、缺口与机会。\n收益：资源投入后的可衡量结果。\n风险：不投入的影响与替代方案。\n需要决定：请领导确认资源与优先级。", sortOrder: 3 },
    { name: "提出新方案", description: "推动一个新想法获得试点和决策支持。", referenceTemplate: "结论：建议先做什么小范围试点。\n机会：要解决的问题与证据。\n方案：关键动作、成本和时间。\n风险与边界：何时停止或调整。\n需要决定：试点范围、负责人和复盘节点。", sortOrder: 4 },
    { name: "反馈问题", description: "及时暴露问题，守住关系并推动解决。", referenceTemplate: "结论：当前问题与建议处理方向。\n事实：已核实的信息，避免推测和归责。\n影响：质量、客户、交付或合规风险。\n处理：已完成动作与推荐方案。\n需要确认：责任边界、资源或决策。", sortOrder: 5 },
  ];
  for (const { name, description, referenceTemplate, sortOrder } of scenarios) await prisma.scenario.upsert({ where: { id: `builtin-${name}` }, update: { description, referenceTemplate, sortOrder, active: true, builtin: true }, create: { id: `builtin-${name}`, name, description, referenceTemplate, sortOrder, builtin: true } });

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
