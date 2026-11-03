# 每日补充发布库存

本文是定时 agent`replenish-queue-daily`的执行手册，人工补库存时也可照此操作。目标：让已审核待发队列在每天发刊之后始终保持 **7 期**。选图、核验和写作的细则仍以 [内容维护说明](content-workflow.md) 为准，队列字段以 [每日自动发布说明](daily-publishing.md) 为准，本文不重复。

## 什么时候做

- 北京时间 13:00 运行，晚于 08:00 的正式发布和 11:00 的兜底检查。
- 每次运行先算缺口：`缺口 = 7 − content/publication-queue.json 中待发期数`。缺口为 0 就结束并汇报“无需补充”。
- 一次最多补 3 期。积压更多时分几天补完，不要为凑数降低标准。
- 新入队期的 `notBefore` 取队尾日期的后一天（队列为空时取明天，按 Asia/Taipei 计算），保持升序，不跳日、不早于明天、不回填。

## 工作副本与前置检查

1. 定时任务使用 Paseo 的 worktree 隔离：每次运行都在一个全新的 worktree 中开始，结束后由 Paseo 归档丢弃，所以不会积累上一次遗留的状态。只在当前 worktree 里工作，不要进入或修改主工作目录 `E:\AISec\time-space-studio`。
2. 新 worktree 的起点可能落后于远端，先执行 `git fetch origin` 和 `git checkout -B replenish origin/main`，再执行 `npm ci`（新 worktree 没有 `node_modules`）。这个分支是一次性的，推送时用 `git push origin HEAD:main`，不要推 `replenish` 分支。
3. 用 `gh run list --workflow daily-publish.yml --limit 3` 确认没有 `queued` 或 `in_progress` 的发布运行。有就稍等（每次不超过 60 秒，总计不超过 10 分钟），仍未结束则停止汇报。
4. 读取 `https://time-space-studio.vercel.app/publication.json` 和本地 `content/library.json`，了解近期各期的主题、媒介、作者、年代，避免重复。

## 每一期要做的事

1. **主题**：给本期一个简短的中文主题，与近期各期不重复；三件作品围绕同一主题，但视觉风格或媒介须明显不同。每周约六成聚焦时间、空间与关系，其余为平面设计、艺术、信息设计和跨媒介作品。
2. **来源**：只用有明确公开许可或属于公有领域的一手来源，例如博物馆、图书馆、档案馆的开放藏品页，或能追溯到这些机构的 Wikimedia Commons 文件页。必须打开来源页核对署名、年代、出处和使用依据；核对不了的作品换掉，不用聚合站、搜索引擎缩略图、来路不明的图片。未知信息写“未知”，不要补造。
3. **图片**：下载获准使用的最高清图，每张小于 20 MB，放入 `content/queue-media/`，新文件名稳定且与 `imageKey` 一致；不覆盖旧图。**必须真的打开每张图看过**，确认画面与记录相符、没有水印或馆方色卡等杂物、分辨率可用；有问题就换。
4. **查重**：对照 `library.json`、队列和 `content/queue-media/`，ID、来源地址、图片字节都不能重复。已有但从未被推荐的作品可以直接引用 ID。
5. **记录**：新作品写入该期 `artworks`，字段符合 `src/lib/types.ts`，`analysis.structure/borrow/application`、`observation`、`evidence`、`rights` 齐全；`writing.author` 与队列项的 `approvedBy` 填 `codex`，`approvedAt` 与 `writing` 时间用实际 ISO 时间，`inputHash` 按现有记录的方式重算。
6. **验证**：运行 `npm run check` 和 `npm run build`，都通过才可提交。

## 提交与汇报

- 只暂存 `content/publication-queue.json` 和 `content/queue-media/` 下的新图。不要改 `content/library.json`、`public/`、`src/` 或工作流。
- 提交信息写明补了哪几期（日期和主题），推送到 `main`。推送被拒就 `git fetch origin && git rebase origin/main`，重新运行 `npm run check` 后再推一次；仍失败就停止并汇报，不要强制推送。
- 严禁运行 `npm run publish:daily` 的非 dry-run 形式，不触发发布工作流，不修改密钥、部署或定时任务设置。
- 用中文汇报：当前日期、补前和补后的队列期数及末期日期、每期主题和三件作品的来源链接、验证结果、提交号。做不到的地方如实写明，不要为了完成数量放宽核验。

## 人工干预

内容已推到 `main` 但尚未发布时，要撤掉某一期，直接删除该期在 `publication-queue.json` 中的条目及其 `content/queue-media/` 图片，运行 `npm run check` 后提交。已经发布的期刊不在此流程内。
