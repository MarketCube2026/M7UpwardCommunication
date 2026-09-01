# 腾讯云香港轻量服务器部署

## 推荐实例

- 地域：香港
- 系统：Ubuntu 24.04 LTS
- 配置：2 vCPU / 4 GB RAM，系统盘至少 60 GB
- 防火墙：仅开放 TCP 22、80、443 和 UDP 443
- 登录：使用 SSH 密钥，关闭公网数据库端口

## 域名

正式内测建议使用独立域名并将 A 记录指向服务器公网 IP。香港服务器不要求 ICP 备案，但中国大陆访问质量仍需使用移动、联通、电信分别实测。

没有独立域名时，可临时使用 `<公网IP>.sslip.io` 作为 `APP_DOMAIN`。该方式仅用于短期验收，不应用于正式推广。

## 首次部署

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

重新登录 SSH 后：

```bash
git clone --branch codex/public-beta https://github.com/MarketCube2026/M7UpwardCommunication.git zhibi
cd zhibi/deploy/tencent-hk
cp .env.server.example .env.server
chmod 600 .env.server
# 编辑 .env.server，填写域名、数据库随机密码、DeepSeek 和管理员配置
docker compose --env-file .env.server up -d --build
docker compose --env-file .env.server run --rm app npm run db:seed:beta
docker compose --env-file .env.server ps
curl -fsS "https://${APP_DOMAIN}/api/health"
```

`.env.server` 不得提交到 Git。首次种子初始化完成后，不要在每次启动时重复执行 `db:seed:beta`，避免覆盖后台调整过的套餐参数。

## 备份

```bash
chmod +x backup.sh
./backup.sh
(crontab -l 2>/dev/null; echo '20 3 * * * /home/ubuntu/zhibi/deploy/tencent-hk/backup.sh') | crontab -
```

备份默认保留 14 天。正式运营前应再增加一份异地对象存储备份。

## 更新

```bash
cd /home/ubuntu/zhibi
git pull --ff-only origin codex/public-beta
cd deploy/tencent-hk
docker compose --env-file .env.server up -d --build
docker image prune -f
```

## 回滚

保留 Vercel 公网地址作为临时回退。应用更新前记录当前 Git commit；需要回滚时切换到该 commit 并重新构建，不要自动回滚数据库结构。
