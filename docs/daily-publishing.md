# 每日自动发布

本任务在 GitHub 托管的 Linux runner 上运行，不依赖 Windows 开机。它发布已经准备好的内容；来源检索、读图核验和写作仍由维护者或 agent 完成。

## 实际时间与入口

- 工作流：`.github/workflows/daily-publish.yml`，名称为 **Publish daily selection**。
- 每天 UTC 00:37 / 02:37，即北京时间 08:37 / 10:37。第二次执行用于重试或检查，已发刊不会再消费下一期。
- 内容日期按 `Asia/Taipei`（与上海当前同为 UTC+8）计算；入库时间使用实际 UTC 时间。
- GitHub 调度可能延迟；任务只在 `main` 运行。公开仓库长期无活动时，GitHub 可能停用定时任务。
- 手动入口：https://github.com/28H2O2/time-space-studio/actions/workflows/daily-publish.yml

## 首轮内容

首轮有 7 期、21 件已收录但尚未进入每日三图的作品，最早发布日期从 2026-10-27 到 2026-11-02。主题包含路线、同步历史、数量与纹样、空间状态变化、几何关系、距离与时间、全景节奏。选图不会增加图像库作品总数，今后也支持包含全新作品的期刊。

`notBefore` 表示最早发布日期，不是必须补发的历史日期。若某天未执行，下次从队首取一期，以实际当天日期发布；不一次集中补发。剩余不超过 2 期时，运行日志会出现 warning；库存耗尽且当天未发刊时，工作流失败并在摘要中说明。GitHub 是否发送失败通知取决于账户通知设置；本流程没有另行创建邮件、聊天通知或 issue。

选图须遵守用户确认的偏好：每期仍为三张，同一天的三张在视觉风格或媒介上明显不同，并持续寻找来源可靠、许可清楚的新风格。具体的读图和来源核验要求见 [内容维护说明](content-workflow.md)。发布程序和现有定时任务不会自动检索新作品或判断风格；队列需要另行补充。

## 队列格式

`content/publication-queue.json` 使用 `version: 1` 和按 `notBefore` 升序排列的 `issues`。每期必须包含：

```json
{
  "id": "queue-a-stable-topic-id",
  "notBefore": "2026-11-03",
  "title": "本期主题",
  "approvedBy": "codex",
  "approvedAt": "2026-10-26T04:00:00.000Z",
  "featuredIds": ["first-work", "second-work", "third-work"],
  "artworks": []
}
```

上例仅说明字段，作品 ID 和审核时间必须换成真实值。`approvedBy` 可为 `human`、`codex` 或 `dot`，代表本期选图确认者，不覆盖作品本身的写作来源。`approvedAt` 应记录实际确认时间。三个 ID 必须互不重复，且没有出现在已发期刊或其他待发期刊中。

已有作品直接引用 ID，`artworks` 留空。全新作品需要把符合 `src/lib/types.ts` 的完整记录放入本期 `artworks`，图片放入 `content/queue-media/`，文件名与 `imageKey` 一致；每条新增作品都必须被该期引用。新作品在发布时才写入 `library.json`，图片移入 `public/media/`，`addedAt` 更新为实际入库时间，`writing` 原样保留。

队列与待发布图片不会被网站打包展示，但它们在公开 Git 仓库中可见，不能存放私人资料。已发布作品与待发布作品共同进行 ID、图片文件名和图片字节去重。

## 准备与验证

1. 按 `docs/content-workflow.md` 选图、核对来源及许可、实际查看图片并写作。
2. 将本期记录加入队列；仅新增作品需要提供 `artworks` 与待发布图片。
3. 执行 `npm run check` 和 `npm run build`，检查提交范围后提交到 `main`。
4. 在 Actions 运行 `rehearse`。它在临时 runner 中模拟下一期、执行检查和构建，保留 7 天的构建产物，不推送、不影响正式网站。
5. 队列正常后，由定时任务或手动 `publish` 发布当天一期。手动发布使用当前日期，不能通过输入任意日期提前或回填期刊。

本地 `npm run publish:daily -- --dry-run` 只报告计划。`--rehearse` 会修改当前工作副本以模拟下一期，适合独立工作副本；它不是只读选项，不要在日常工作区随意执行。正常发布命令同样会改动内容文件，提交和推送仅由工作流负责。

## 发布与恢复

工作流会先校验原始库和队列，准备一期开刊，再次检查并构建；只有这些步骤全部成功后，才暂存内容库、队列及相关图片，使用 `GITHUB_TOKEN` 提交并推送 `main`。不强制推送；遇到其他提交导致推送冲突时，本次失败，下一次重新读取 `main`。

GitHub 自带令牌推送不会再次触发普通 `push` 工作流，因此本工作流自行执行完整检查。Vercel 使用仓库已连接的 Git 集成部署。可选的仓库 Secret `VERCEL_DEPLOY_HOOK` 支持显式触发部署；未配置时不会调用 Hook，也不要求添加个人 GitHub 令牌。

构建额外生成 `dist/publication.json`，包含内容库 SHA-256、最新期刊和三张图片的 SHA-256。发布任务最多等待 10 分钟，对照正式站 `https://time-space-studio.vercel.app/publication.json` 和实际图片字节；仅有提交或部署 API 接受请求不足以通过核验。

若推送成功但部署未完成，后续运行不会重复发刊，会继续核验相同内容。若 Vercel 构建失败，需要先查看 Vercel 日志、修复或重新部署；配置了 Deploy Hook 时，重试会重新请求部署。工作流失败与库存状态显示在 Actions 日志和运行摘要中。

停用方式：在 Actions 页面选择此工作流并点击 **Disable workflow**。重新启用后只处理当前日期的一期，不补发全部遗漏日期。

## 官方参考

- [GitHub 定时触发与限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GITHUB_TOKEN 对后续工作流触发的影响](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Vercel GitHub 集成](https://vercel.com/docs/git/vercel-for-github)
- [可选 Vercel Deploy Hook](https://vercel.com/docs/deploy-hooks)
