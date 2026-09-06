# Agent Daily 域名与发布路由

## 2026-09-06 个人域名展示合同（优先于下方历史说明）

对外主入口为 https://shixilin.com/ai/agent-daily ，浏览器必须停留在此域名；英文、日期页和资源使用该路径的对应子路径。两个旧域名保留，以单次 308 跳到个人域名对应页面，查询参数保留。收藏名称与浏览器标题去掉 ALUX，汇总首页为 Agent Daily · AI智能体日报。

日报仍由本仓库发布，稳定源站为 https://alux-ai-agent-daily.vercel.app 。个人站服务端读取源站，并统一转换站内路径、canonical、hreflang、sitemap 和收藏标题。源站默认域名不得重定向到个人站，以免循环。为保留历史哈希与现有生成合同，本仓库原始构建产物继续使用 /daily 和旧域名；它们属于内部兼容格式，个人域名实际响应使用新地址。部署门禁比较经过 scripts/daily-public-presentation.cjs 确定性转换后的完整正文哈希，不能跳过内容一致性验证。

维护转换规则时同步个人站 lib/agent-daily.js 和本仓库 scripts/daily-public-presentation.cjs。普通每日发布不需要改 DNS，也不需要重新部署个人站；源站内容更新后个人站缓存通常 60 秒刷新。现有任务的兼容链接可继续使用且会自动进入个人域名；历史内容和已发通知不批量重写。

## 路径验收

| 请求 | 结果 |
| --- | --- |
| https://shixilin.com/ai/agent-daily | 中文汇总首页 200，地址不变 |
| 个人路径 /en/、/latest/、/en/latest/、/YYYY/MM/DD/、/en/YYYY/MM/DD/ | 同期对应页面 200，站内切换留在个人域名 |
| https://ai.alux.network/daily/ 及同期子路径 | 单次 308 到个人地址 |
| https://ai-agent-daily.alux.network/ 及同期子路径 | 单次 308 到个人地址 |
| https://ai.alux.network/ | 单次 308 到个人汇总首页 |
| https://alux-ai-agent-daily.vercel.app/ | 稳定源站 200，不跨域跳转 |

旧链接带查询参数时仍保留参数；旧日期页不得跳到最新一期。个人站正常根首页继续显示个人网站。

## 发布与故障检查

1. 拉取 main，按 3.8.0 合同生成中英日报、独立审校、构建并通过结构、版式和发布边界检查。
2. 日常使用 scripts/publish.ps1；维护更改单独提交。Vercel 从 main 自动部署原始日报。
3. 运行 node scripts/verify-official-deployment.cjs YYYY-MM-DD，验证个人域名六页完整内容及两个旧域名的单次 308。
4. 内容未更新先核对日报仓库部署与缓存；502 检查个人站函数能否读取稳定源站；子页 404 检查含尾斜杠的路径匹配。
5. 日常不改 DNS，不记录密钥、账号、Cookie 或私密运行记录。原始 content 母稿与翻译哈希不因域名迁移而重写。

汇总首页顶部与页脚提供 https://shixilin.com/ 个人站链接；手机端导航换行。个人站首页及 AI 产品卡指向个人日报主入口。
