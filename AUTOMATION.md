# 自动化与 Agent 接续说明

## 2026-09-06 个人域名展示合同（优先于下方历史说明）

对外主入口为 https://shixilin.com/ai/agent-daily ，浏览器必须停留在此域名；英文、日期页和资源使用该路径的对应子路径。两个旧域名保留，以单次 308 跳到个人域名对应页面，查询参数保留。收藏名称与浏览器标题去掉 ALUX，汇总首页为 Agent Daily · AI智能体日报。

日报仍由本仓库发布，稳定源站为 https://alux-ai-agent-daily.vercel.app 。个人站服务端读取源站，并统一转换站内路径、canonical、hreflang、sitemap 和收藏标题。源站默认域名不得重定向到个人站，以免循环。为保留历史哈希与现有生成合同，本仓库原始构建产物继续使用 /daily 和旧域名；它们属于内部兼容格式，个人域名实际响应使用新地址。部署门禁比较经过 scripts/daily-public-presentation.cjs 确定性转换后的完整正文哈希，不能跳过内容一致性验证。

维护转换规则时同步个人站 lib/agent-daily.js 和本仓库 scripts/daily-public-presentation.cjs。普通每日发布不需要改 DNS，也不需要重新部署个人站；源站内容更新后个人站缓存通常 60 秒刷新。现有任务的兼容链接可继续使用且会自动进入个人域名；历史内容和已发通知不批量重写。


如果你是负责在另一台电脑生成 ALUX AI智能体情报日报的 Agent 或自动化执行器，请先完整读取：

1. `AGENTS.md`
2. `docs/REPORT_STYLE_GUIDE.md`
3. `docs/RESPONSIVE_LAYOUT_STANDARD.md`
4. `docs/DAILY_PUBLISH_CHECKLIST.md`
5. `docs/DOMAIN_ROUTING.md`
6. `docs/PUBLIC_REPOSITORY_BOUNDARY.md`
7. `docs/SHARE_CARD_STANDARD.md`
8. `.baoyu-skills/baoyu-translate/EXTEND.md`
9. `automation/OPENCLAW_DAILY_TASK.md`

读完后，保留你原有自动化的执行时间和时区，按 `automation/OPENCLAW_DAILY_TASK.md` 替换任务正文。`automation/task-contract.json` 是供 Agent 和脚本读取的机器可读合同。

## 首次接管先升级自己的自动化

1. 读取 `automation/task-contract.json` 的 `contractVersion`。
2. 找到你已经存在的日报自动化任务，不新建重复任务。
3. 保留原任务 ID、schedule、时区、通知对象和凭据配置，只用 `automation/OPENCLAW_DAILY_TASK.md` 替换任务正文；运行档固定为 `openai/gpt-5.6-sol`、`thinking=high`、标准速度、无 fallback。
4. 确认正文含当前版本标记 `[ALUX_DAILY_CONTRACT_VERSION: 3.8.0]`。
5. 先手动执行一次 dry run；只有中英生成、构建和验收都通过，才让升级后的任务进入下一次定时运行。

## 你的完整任务

一次日报发布不是“只生成一份中文 HTML 并上传”。完整交付必须包含：

1. 先读取 `templates/report-master.json`，按其固定的 `2026-08-26-editorial-v3.1` 母版生成中文母稿并保存到 `content/zh/`；不得把“最近一期”当作可逐日漂移的新母版。在定稿前先完成私有的大厂 GitHub/Hugging Face 扫描，对所有 `must-review` 留下明确取舍，经核验的重要开放权重/开源发布优先入选；每天核对持续观察项，无变化不重复、正式开放变化立即入选。每天还要监测 Codex 自动/全局额度重置与重置卡的实际事件，只有 OpenAI/Codex 官方、已确认团队成员或 OpenAI Support 的明确公告才能入选；帮助页解释、个人截图、传言和无可靠来源的社交记录不得成稿。所有 GitHub 开源/Skill 推荐都要刷新当天 Stars 与许可证状态。每天目标 12-18 条独立消息，其中 5-7 条重点详报，其余为短讯；重大新闻多时可增加，材料不足必须先补查并记录具体原因，不拿旧闻凑数。普通开发工具版本更新合计最多 2 条，不受 category 标签影响。重要新模型（含闭源/API/开放权重）必须优先核查并入选；有趣发现目标至少 3 条，覆盖创作、游戏、生活应用、机器人或独立小项目。并遵守首屏精简、统计语义分离以及导读/雷达分工。
2. 按项目术语表执行母语级英文精修，保存到 `content/en/`。
3. 核对中英两版事实、数字、产品名、版本号、章节结构和所有来源链接。RISC 只作为新版前置机器说明。
4. 更新 `content/en/translation-manifest.json` 并将已精修的当期标记为 `reviewed`。
5. 运行生成和验收脚本，让中英首页、最新页、日期页、语言切换、归档和 sitemap 同时更新。
6. 全部验收通过后，只将当期中英母稿、翻译清单与 `public/` 成品一起直接提交并推送正式仓库 `main`；不创建 PR、不等待人工合并。内部研究包、日志、prompt、manifest、ledger、截图和工具输出不得进入仓库。
7. 等待 Vercel 完成部署，并用 `scripts/verify-official-deployment.cjs` 验证正式域名与本地成品哈希一致。OpenClaw 只有在这一步通过后才能发送固定多行纯文字链接通知，不得附带日报文件。

英文内容变长时，不得保留中文模板的窄固定标签列。热区矩阵在宽屏使用至少 `172px` 的英文标签列并允许自然换行，在 `620px` 及以下变为单列；任何标签、强度徽章或正文重叠都会让 `render-check.cjs` 失败并阻止发布。

中文和英文不能共享同一套机械断句：中文按完整语义短语控制节奏，英文按主谓、修饰关系和英文标题习惯重写。不得使用 `<br>`、`&nbsp;` 或隐藏字符针对某个屏幕硬断行。发布前运行 `node scripts/verify-locale-copy.cjs YYYY-MM-DD`，并查看 1440 桌面、768 平板、390 手机三端截图。

英文翻译合同固定为：目标语言美式英语（`en-US`）；翻译模式为精译并完整执行“分析 → 初译 → 独立审校 → 润色”；目标读者是全球 AI Agent、基础设施、技术与商业读者；文风是母语级科技情报出版物，专业、简洁、准确、权威，不逐字直译。独立审校必须由不同编辑上下文完成；任何 Agent 不得自行降级为直译、浏览器即时翻译或未经审校的机器翻译。

`.panel-head` 标题与右侧说明同样不得重叠，`920px` 及以下改为上下排列。顶栏 Logo 和语言切换外框必须保持 `44px` 等高；不得删除、跳过或弱化这些真实文字边界门禁。

需要生成对外扫码卡时，必须使用 `tools/share-card/` 中的固定模板与验证脚本。最终只交付 3:4、3072×4096 的 RGB JPG；过程 PNG 必须自动删除，二维码须在 4K 原图以及 1080、720、540、360 像素宽的 JPEG 压缩模拟中全部解码到正式中文站域名。

## 如果你只找到中文新一期

不要直接发布。先补齐对应日期的英文母稿，执行“分析 → 初译 → 审校 → 润色”，再更新翻译清单。构建脚本会在英文缺失、哈希过期或未审核时主动停止。

## 首页如何更新最新一期

不手工编辑首页，也不手工复制到 `public/latest/`。

`scripts/sync-reports.ps1` 会扫描 `content/zh/` 中日期最新的母稿，找到同日期的已审英文母稿，然后自动更新：

- <https://ai.alux.network/daily/> 的最新一期卡片、日期、摘要、数量和历史归档
- `/daily/latest/` 与 `/daily/en/latest/`
- 中英日期页和同期语言切换
- `/daily/archive.json`、`/daily/en/archive.json` 和 `/daily/sitemap.xml`

正式部署后还必须验证 `https://ai-agent-daily.alux.network/` 及其 `/en/`、`/latest/`、日期路径均以单次永久重定向到 `https://ai.alux.network/daily/` 下的对应路径。旧域名只承担兼容，不得继续写入 canonical、hreflang、sitemap 或新生成的对外物料。

公开域名、重定向与故障排查的当前权威规则见 `docs/DOMAIN_ROUTING.md`。其他电脑上的日报专用 Agent 每次发现合同版本升级时都必须重读该文件；正常日报发布不需要、也不得修改 DNS。

只要母稿、英文翻译和审核清单正确，首页最新内容就会在生成时自动跟随。

## 一键顺序

```powershell
node ./scripts/verify-report-master.cjs
node ./scripts/verify-locale-copy.cjs YYYY-MM-DD
pwsh -NoProfile -File ./scripts/update-translation-manifest.ps1 -Date YYYY-MM-DD -MarkReviewed
pwsh -NoProfile -File ./scripts/sync-reports.ps1
pwsh -NoProfile -File ./scripts/verify-site.ps1
node ./scripts/render-check.cjs
node ./scripts/verify-release-boundary.cjs YYYY-MM-DD
pwsh -NoProfile -File ./scripts/publish.ps1
node ./scripts/verify-official-deployment.cjs YYYY-MM-DD
```

简单任务可直接双击仓库根目录的 `更新并发布日报.cmd`，但在翻译未精修完成前不得使用 `-MarkReviewed`。


## 2026-09-06 编辑升级（3.8.0）

每天目标 12-18 条独立消息，其中 5-7 条重点详报，其余为短讯；重大新闻多时可增加，材料不足必须先补查并记录具体原因，不拿旧闻凑数。普通开发工具版本更新合计最多 2 条，不受 category 标签影响。重要新模型（含闭源/API/开放权重）必须优先核查并入选；有趣发现目标至少 3 条，覆盖创作、游戏、生活应用、机器人或独立小项目。

新模型逐厂商检查官网公告、产品/API 更新，覆盖闭源与开放权重；另行扫描图像视频、音乐声音、互动游戏、生活创作、机器人与独立项目。候选保留来源和取舍理由，重大新模型漏报即阻断。OpenClaw 完整执行细则见本机 `tasks/alux-ai-agent-daily-brief-cron-prompt.md` 与 `tasks/alux-daily-editorial-coverage.json`，发布 pre 门禁会调用专用选题检查器。

详报和短讯都保留原 `.signal`、`.side` DOM、来源与日期，按主题混排于现有栏目；短讯五项文字分别为 35-80、10-40、5-25、10-40、10-40 字。旧单卡长字数指引只适用于详报。条数目标的例外须有完成扫描和候选取舍的内部证据。历史期数按原日期规则验收。
