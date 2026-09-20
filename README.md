# Agent Daily · AI智能体日报

由 [光之十一](https://shixilin.com/) 出品，关注重要新模型、AI Agent、开源项目，以及好玩、实用的新发现。

[中文首页](https://shixilin.com/ai/agent-daily) · [English](https://shixilin.com/ai/agent-daily/en/) · [最新一期](https://shixilin.com/ai/agent-daily/latest/)

## 内容与语言

每期保留简体中文与美式英语两个版本，共享事实、数字、结构和来源。英文经过初译、独立审校及润色。顶栏使用 **中 / EN**，切换到同一期。

首页、最新页和归档统一来自正式稿件，不再由自动雷达覆盖，也不自动发布未经审校的机器翻译。每期日期链接长期保留。

## 仓库结构

- `content/zh/`：中文正式母稿。
- `content/en/`：英文母稿与审校哈希清单。
- `templates/`、`assets/`：版式与共享样式。
- `scripts/`：构建、内容验收、响应式检查及发布。
- `public/`：脚本生成的部署成品，不直接编辑。

```bash
node scripts/sync-reports.cjs
node scripts/verify-site.cjs
node scripts/render-check.cjs
```

日常发布使用 `node scripts/publish.cjs`。维护变更与每日内容分开提交；只在内容、独立审校、渲染及公开仓库边界检查通过后推送。推送后还须验证正式域名，再发送通知。

## 自动化与域名

OpenClaw 负责正式日报，使用统一的 Astra low 配置，以及一套主任务、验收和恢复调度。GitHub Actions 只负责公开信号采集和正式日报完整性监测，不能另写一份竞争首页的内容。

主入口为 `https://shixilin.com/ai/agent-daily`。旧域名及历史地址保留并永久跳转到对应个人域名页面。稳定 Vercel 源站与内部 `/daily/` 路径用于部署兼容，不改 DNS。

维护前阅读 [AGENTS.md](AGENTS.md)、[自动化合同](AUTOMATION.md)、[运维说明](docs/OPERATIONS.md) 和 [域名路由合同](docs/DOMAIN_ROUTING.md)。来源证据、运行日志、发送账本与凭据不进入公开仓库。
