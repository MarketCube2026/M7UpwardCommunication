import { z } from "zod";

export const supervisorSchema = z.object({
  name: z.string().trim().min(1, "姓名不能为空").max(80),
  position: z.string().max(120).optional().nullable(),
  relation: z.string().max(80).optional().nullable(),
  tags: z.array(z.string().max(30)).max(12).default([]),
  communicationPrefs: z.record(z.string()).default({}),
  workStyle: z.record(z.string()).default({}),
  taboos: z.string().max(1000).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
});

export const evaluationSchema = z.object({
  styleMatchScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  riskAlertScore: z.number().min(0).max(100),
  behaviorScore: z.number().min(0).max(100).optional(),
  keyStrengths: z.array(z.string()).default([]),
  riskAlerts: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  rewrittenVersion: z.string(),
  behaviorFeedback: z.array(z.string()).optional(),
  baselineChecks: z.array(z.object({ label: z.string(), passed: z.boolean(), note: z.string() })).default([]),
  mode: z.enum(["ai", "demo"]),
});

export const rehearsalSchema = z.object({
  supervisorId: z.string().min(1),
  scenarioId: z.string().min(1),
  inputText: z.string().trim().min(1).max(10000),
  actionPlan: z.string().max(5000).optional().nullable(),
});

export const scenarioSchema = z.object({
  name: z.string().trim().min(1, "场景名称不能为空").max(80),
  description: z.string().trim().max(2000).optional().nullable(),
  referenceTemplate: z.string().trim().max(5000).optional().nullable(),
});
