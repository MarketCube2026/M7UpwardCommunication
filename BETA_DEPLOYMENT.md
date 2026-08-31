# 知彼 V2 公网内测部署

本分支用于独立的 Vercel 邀请制内测，不覆盖 V1、Cloudflare 或本地商业版分支。

## 基础设施

- 应用：新的 Vercel Project
- 数据库：新的 Neon PostgreSQL 项目，仅供内测
- 域名：首轮使用 Vercel 默认地址
- AI：DeepSeek 服务端密钥
- 登录：一次性邀请链接激活后使用手机号和密码
- 支付：完全关闭，仅记录套餐购买意向

## 必需环境变量

```
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=...
AI_MODEL=deepseek-chat
DEMO_MODE=false
LOCAL_AUTH_MODE=false
PUBLIC_BETA_MODE=true
BETA_GRANT_CREDITS=30
OTP_PEPPER=随机长字符串
ADMIN_USERNAME=内测管理员账号
ADMIN_INITIAL_PASSWORD=强密码
```

密钥只能配置在 Vercel Project Environment Variables，不得写入仓库或日志。

## 首次发布

1. 新建 Neon 数据库，将 pooled connection string 配置到 `DATABASE_URL`，将 direct connection string 配置到 `DATABASE_URL_UNPOOLED`。
2. 新建 Vercel Project，关联本分支，并配置上述环境变量。
3. Vercel 构建运行 `npm run vercel-build`，只同步数据库结构，不初始化业务数据。
4. 在受控终端使用同一 `DATABASE_URL` 执行 `npm run db:seed:beta`，初始化套餐、公共场景和管理员。
5. 访问 `/api/health`、`/admin/login`，创建首个邀请并完成端到端验收。

## 上线保护

- `PUBLIC_BETA_MODE=true` 时验证码注册、订单创建和模拟支付均被服务端拒绝。
- 邀请原始 token 只在创建时返回，数据库只保存 SHA-256 哈希。
- 每个邀请默认 14 天有效、仅可激活一次；每位测试者默认获赠 30 次 `BETA_GRANT` 权益。
- 本地 `npm run build` 仍使用 SQLite；只有 `vercel-build` 使用隔离生成的 PostgreSQL schema。
