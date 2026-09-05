# ALUX AI Agent Intelligence Daily · Agent 接班说明

仓库公开名称为 `shixi-11/ai-agent-daily`，正式 origin 为 `https://github.com/shixi-11/ai-agent-daily.git`；旧仓库地址由 GitHub 重定向。Vercel 稳定源站和既有本地路径仍保留兼容名称，不能机械替换所有 `alux-ai-agent-daily` 字符串。

## 2026-09-06 个人域名展示合同（优先于下方历史说明）

对外主入口为 https://shixilin.com/ai/agent-daily ，浏览器必须停留在此域名；英文、日期页和资源使用该路径的对应子路径。两个旧域名保留，以单次 308 跳到个人域名对应页面，查询参数保留。收藏名称与浏览器标题去掉 ALUX，汇总首页为 Agent Daily · AI 日报。

日报仍由本仓库发布，稳定源站为 https://alux-ai-agent-daily.vercel.app 。个人站服务端读取源站，并统一转换站内路径、canonical、hreflang、sitemap 和收藏标题。源站默认域名不得重定向到个人站，以免循环。为保留历史哈希与现有生成合同，本仓库原始构建产物继续使用 /daily 和旧域名；它们属于内部兼容格式，个人域名实际响应使用新地址。部署门禁比较经过 scripts/daily-public-presentation.cjs 确定性转换后的完整正文哈希，不能跳过内容一致性验证。

维护转换规则时同步个人站 lib/agent-daily.js 和本仓库 scripts/daily-public-presentation.cjs。普通每日发布不需要改 DNS，也不需要重新部署个人站；源站内容更新后个人站缓存通常 60 秒刷新。现有任务的兼容链接可继续使用且会自动进入个人域名；历史内容和已发通知不批量重写。


本文件是所有继续维护者的第一入口。克隆或同步仓库后，先读本文件，再读 `README.md`、`AUTOMATION.md`、`docs/OPERATIONS.md`、`docs/DOMAIN_ROUTING.md`、`docs/RESPONSIVE_LAYOUT_STANDARD.md`、`docs/PUBLIC_REPOSITORY_BOUNDARY.md` 与 `docs/SHARE_CARD_STANDARD.md`。OpenClaw Agent 还必须读 `automation/OPENCLAW_DAILY_TASK.md`，并用该合同升级现有定时任务的正文。

当前自动化合同版本为 `3.8.0`。OpenClaw 发现现有日报任务没有 `[ALUX_DAILY_CONTRACT_VERSION: 3.8.0]` 时，必须保留原任务 ID、执行时间、时区和凭据，只替换任务正文并完成一次 dry run；不得另建一个重复任务。日报主任务使用 `openai/gpt-5.6-sol`、`thinking=high`、标准速度并禁用 fallback；验收与恢复继续按各自无模型 command payload 执行，只有内容级恢复才唤起同一模型。

负责在其他电脑生成并提交日报的专用 Agent，必须额外阅读 `docs/DOMAIN_ROUTING.md`。DNS 已完成配置，日常发布不得修改 DNS；它只需按合同生成中英内容、重建站点、推送 `main`，再同时验证新主地址与旧域名兼容入口。

## 任务目标

维护 ALUX AI智能体情报日报的中英双语正式站点：

- 正式主地址：<https://ai.alux.network/daily/>
- 永久兼容入口：<https://ai-agent-daily.alux.network/>；旧入口及其历史路径必须永久重定向到新主地址下的同期路径。
- 中文首页：`/daily/`
- 英文首页：`/daily/en/`
- 中文日期页：`/daily/YYYY/MM/DD/`
- 英文日期页：`/daily/en/YYYY/MM/DD/`
- 中英两版必须指向同一期、保留同一组事实与来源链接。

## 权威数据与生成结果

| 目录 | 用途 | 是否可直接编辑 |
| --- | --- | --- |
| `content/zh/` | 中文 HTML 母稿，一期一份 | 是 |
| `content/en/` | 英文精修 body 母稿与翻译清单 | 是 |
| `.baoyu-skills/baoyu-translate/EXTEND.md` | 翻译语言、读者、文风与术语表 | 是，修改后要重审受影响译文 |
| `templates/` | 中英首页、404 模板与日报正式母版合同 | 是 |
| `assets/` | 日报页共享导航与响应式样式 | 是 |
| `assets/share-cards/` | 已确认、可对外使用的正式分享卡 JPG | 是 |
| `scripts/` | 生成、审核、渲染与发布逻辑 | 是 |
| `tools/share-card/` | 对外扫码卡模板、二维码生成与 JPG 验收 | 是 |
| `public/` | Vercel 部署成品 | 否；只能由脚本重建 |
| `output/` | 本机导出的分享图等成品，不提交 GitHub | 否；由工具重建 |

`content/` 是仓库内的唯一内容权威源。不得依赖仓库外的本地文件夹，不得只修改 `public/`。

## 新一期的固定流程

1. 查看 `content/zh/`、`content/en/translation-manifest.json` 与 Git 状态，确认最新日期和未完事项。
2. 新建 `content/zh/YYYYMMDD_ALUX_AI智能体情报日报.html`。不覆盖历史日期。
3. 按项目翻译配置执行“分析 → 初译 → 独立审校 → 润色”，新建 `content/en/YYYYMMDD.body.html`；独立审校必须由不同编辑上下文完成，不能由初译同一遍输出自行认证。
4. 核对中英两版的数字、产品名、版本号、类别、结构和外部来源链接。RISC 只保留前置机器说明，不对单条新闻打分。
5. 新一期必须读取 `templates/report-master.json`，以其中固定的 `2026-08-26-editorial-v3.1` 为唯一日报母版；复制结构和 CSS，只替换当日内容。每天目标 12-18 条独立消息，其中 5-7 条重点详报，其余为短讯；重大新闻多时可增加，材料不足必须先补查并记录具体原因，不拿旧闻凑数。普通开发工具版本更新合计最多 2 条，不受 category 标签影响。重要新模型（含闭源/API/开放权重）必须优先核查并入选；有趣发现目标至少 3 条，覆盖创作、游戏、生活应用、机器人或独立小项目。Hero 四项统计必须分别表达值得关注、可动手试、开源发现和覆盖区域。`今日AI导航` 只做事实地图，`AI Agent雷达` 只做跨信号综合判断。新闻正文在上，“试试看 / 注意点”在下，标签和正文保持紧凑；公开页不出现选题边界、观察理由或其他编辑过程话术。
   每天另行监测 OpenAI Codex 自动/全局额度重置和重置卡的实际发生与发放。只有 OpenAI/Codex 官方、已确认 Codex 团队成员或 OpenAI Support 明确宣布的公开事件才能进入正文，并绑定内部确认事件 ID；帮助页释义、个人截图、社区讨论、传言和无可靠来源的社交记录都不是新闻。没有确认事件时日报完全不提。
6. 更新翻译清单，只有人工或 Agent 精修复核后才可标记 `reviewed`。
7. 依次执行：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-reports.ps1
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-site.ps1
   node .\scripts\render-check.cjs
   ```

8. 检查生成截图和验证输出，并运行 `node scripts/verify-release-boundary.cjs YYYY-MM-DD`；只有全部通过后才可提交和推送。日常发布使用 `scripts/publish.ps1`，它只允许当期中英文母稿、翻译清单和脚本生成的 `public/` 进入提交，并直接提交、推送正式仓库 `main`，不创建 PR、不等待人工合并。
9. 推送 `main` 后运行 `node scripts/verify-official-deployment.cjs YYYY-MM-DD`；只有新主地址的中英首页、最新页、日期页与本地成品哈希一致，并且旧域名对应路径只经过一次永久重定向，才算发布完成。

## 翻译标准

- 目标语言：美式英语（`en-US`）。
- 翻译模式：精译，必须完整执行“分析 → 初译 → 独立审校 → 润色”，不得省略任何阶段，也不得由初译者在同一遍输出里自行宣称审校通过。
- 目标读者：全球 AI Agent、基础设施、技术与商业读者。
- 文风：母语级科技情报出版物，专业、简洁、准确、权威，不逐字直译。
- 不得发明事实、更改数字、替换来源或扩大 ALUX 已有能力。
- 英文母稿中不得残留未处理的中文。中国公司或机构名应使用其官方英文名或可识别的罗马化。
- 术语以 `.baoyu-skills/baoyu-translate/EXTEND.md` 为准。

## 强制验收门槛

- 中英日期集合完全一致，不允许只发布单语新一期。
- 清单中的中文源哈希、英文母稿哈希与当前文件一致，状态为 `reviewed`。
- 中英两版的外链集合、重点信号数、章节数和来源数一致。
- 中文按语义短语自然断句，英文按 en-US 语法重新组织；禁止用 `<br>`、`&nbsp;` 或不可见字符修补单一屏宽。最新一期必须通过 `verify-locale-copy.cjs`。
- 首页、最新页、最早/中间/最新日期页在 1920、1440、1024、768、620、430、390、320 px 下无横向溢出、裁切、单字孤行或导航遮挡。
- 1440、768、390 是桌面、平板、手机三端代表视图；除防溢出外，还要验证统计、雷达、RISC 与实用区在三端按合同重排，并检查中英文标题没有语义硬断行。
- 英文热区矩阵不得沿用中文版的窄固定标签列。宽屏标签列至少 `172px`，长标签允许自然换行；`620px` 及以下改为单列。标签和强度徽章不得越过自身网格单元、遮住右栏正文，`render-check.cjs` 的 `heat-row` 重叠检测必须通过。
- 英文 `.panel-head` 的标题与右侧说明不得相互覆盖，`920px` 及以下必须上下排列。自动验收必须读取真实文字边界，不得只检查元素外框。
- 顶栏 Logo 外框与语言切换外框统一为 `44px` 高并垂直对齐，每个语言按钮保留至少 `44px` 点击高度。
- 日报页顶栏分隔线、品牌区和正文内容网格必须对齐；桌面、平板、手机分别跟随正文的 `22px`、`14px`、`10px` 内边距。
- 语言切换必须指向同一期；`canonical` 与 `hreflang` 必须正确。
- 中文站名固定为 `ALUX AI智能体情报日报`，不在 `AI` 与 `智能体` 之间加空格。
- 首页固定界面文案按页面语言完整本地化：中文版副标题使用 `全球AI、智能体与开源`，眉题、最新一期、归档说明与页脚均使用中文；英文首页保留对应英文。`ALUX`、`AI`、`GitHub` 等品牌或技术专名及 `EN` 语言按钮不作机械翻译。模板和构建后的首页必须通过 `verify-locale-copy.cjs` 检查。
- 英文站名固定为 `ALUX AI Agent Intelligence Daily`，公开链接固定使用 `https://ai.alux.network/daily/`，不得用 Vercel 预览域名替代。
- `https://ai-agent-daily.alux.network/` 只作为永久兼容入口；旧首页、英文页、最新页和日期页必须以单次永久重定向到新主地址下的对应路径，不得形成跳转链或返回 404。
- 对外扫码卡只交付 3:4、3072×4096、RGB JPG；二维码和版式必须通过 `docs/SHARE_CARD_STANDARD.md` 的压缩扫码门禁。

## 禁止事项

- 不直接编辑 `public/`。
- 不使用浏览器即时机器翻译或客户端假切换。
- 不在英文未审校、验证脚本失败或 Git 工作区含不明变更时发布。
- 不修改、删除或覆盖历史日期链接。
- 不把密钥、OAuth、`.env.local` 或 `.vercel/` 提交到 GitHub。
- 不把 OpenClaw prompt、manifest、research packet、ledger、工作日志、质量门禁日志、截图、工具输出、自言自语或本地路径提交到 GitHub。日常提交白名单只有当期 `content/zh/`、`content/en/`、`content/en/translation-manifest.json` 与脚本重建的 `public/`。

## OpenClaw Telegram 交付

OpenClaw 只能在正式域名通过部署验证后发送纯文字链接通知，不再发送 HTML、ZIP、图片或其他日报附件。固定域名承担长期存储、双语切换和历史归档。正文固定为以下格式，空行必须保留：

```text
【ALUX AI智能体情报日报】

固定入口：
https://ai.alux.network/daily/

YYYY-MM-DD：
https://ai.alux.network/daily/YYYY/MM/DD/
```

固定入口和日期页必须指向同一期；固定入口内提供中英切换，不在 TG 通知中另列英文站。不得发送 Vercel 预览域名、临时隧道或尚未部署完成的链接。中英文内容必须先在本地完成并独立审校，语言切换栏由仓库构建统一注入。

## 接续已有任务

如果工作区已有未提交变更，先阅读 `git diff`、翻译清单和验证输出，从现有进度继续；不要重做已完成的期数，不要用旧快照覆盖当前母稿。


## 2026-09-06 编辑升级（3.8.0）

每天目标 12-18 条独立消息，其中 5-7 条重点详报，其余为短讯；重大新闻多时可增加，材料不足必须先补查并记录具体原因，不拿旧闻凑数。普通开发工具版本更新合计最多 2 条，不受 category 标签影响。重要新模型（含闭源/API/开放权重）必须优先核查并入选；有趣发现目标至少 3 条，覆盖创作、游戏、生活应用、机器人或独立小项目。

新模型逐厂商检查官网公告、产品/API 更新，覆盖闭源与开放权重；另行扫描图像视频、音乐声音、互动游戏、生活创作、机器人与独立项目。候选保留来源和取舍理由，重大新模型漏报即阻断。OpenClaw 完整执行细则见本机 `tasks/alux-ai-agent-daily-brief-cron-prompt.md` 与 `tasks/alux-daily-editorial-coverage.json`，发布 pre 门禁会调用专用选题检查器。

详报和短讯都保留原 `.signal`、`.side` DOM、来源与日期，按主题混排于现有栏目；短讯五项文字分别为 35-80、10-40、5-25、10-40、10-40 字。旧单卡长字数指引只适用于详报。条数目标的例外须有完成扫描和候选取舍的内部证据。历史期数按原日期规则验收。
