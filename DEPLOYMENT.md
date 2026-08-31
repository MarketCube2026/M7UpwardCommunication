# 知彼 Cloudflare 部署

## 架构

- GitHub：源码备份与 Cloudflare Pages 自动构建来源
- Cloudflare Pages：静态 PWA 前端（`out`）
- Cloudflare Workers：`workers/api/src/index.ts` API 和 DeepSeek 调用
- Cloudflare D1：档案、场景、演练、复盘数据
- Cloudflare R2：`POST /api/backups` 生成的数据库 JSON 快照，以及后续附件预留

## 一次性初始化

在项目根目录执行：

```bash
npx wrangler login
npx wrangler d1 create zhibi
npx wrangler r2 bucket create zhibi-files
```

将 `wrangler d1 create` 输出的 `database_id` 填入 `wrangler.toml` 的 `database_id`。然后初始化生产数据库和 Worker 密钥：

```bash
npm run cf:d1:remote
npx wrangler secret put AI_API_KEY
npm run cf:deploy:api
```

`AI_API_KEY` 仅作为 Worker Secret 保存，绝不写入 Pages 环境变量、Git 或前端代码。

## Pages 发布

在 Cloudflare Dashboard 创建 Pages 项目并连接 `MarketCube2026/M7UpwardCommunication`：

- Production branch：`main`
- Build command：`npm run build:pages`
- Build output directory：`out`
- Node.js：`22`
- Environment variable：`NEXT_PUBLIC_API_BASE_URL=https://<你的-worker>.<你的-subdomain>.workers.dev`

首次 Worker 发布后会显示实际 URL；把它填到 Pages 环境变量后重新部署 Pages。最终 Pages 域名确定后，在 `wrangler.toml` 设置 `FRONTEND_ORIGIN`，再次发布 Worker，以限制浏览器跨域来源。

## 本地开发

- `npm run dev`：保留现有 Next + Prisma/SQLite 本地模式
- `npm run build:pages`：生成 Cloudflare Pages 静态文件；构建时临时排除本地 Next API 路由，完成后自动恢复
- `npm run cf:deploy:api`：发布 Worker

## 数据与访问控制

当前 MVP 没有登录系统。发布到公网前，应使用 Cloudflare Access 保护 Pages 和 Worker，或在下一版加入用户认证；CORS 不是身份校验。R2 快照包含全部业务数据，应保持私有桶权限。
