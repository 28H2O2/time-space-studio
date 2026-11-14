# 每日自动发布

发布本身在 GitHub 托管的 Linux runner 上运行，但工作流不再有 GitHub 定时触发，每天由本机 Paseo 定时任务通过 `workflow_dispatch` 触发。它发布已经准备好的内容；来源检索、读图核验和写作仍由维护者或 agent 完成。

## 实际时间与入口

- 工作流：`.github/workflows/daily-publish.yml`，名称为 **Publish daily selection**。
- 触发方：Paseo 定时任务「时空图像室｜每日发布兜底」，每天北京时间 08:00 / 11:00（cron `0 8,11 * * *`，时区 `Asia/Shanghai`）。每次启动一个 agent，检查线上清单、远端 `main` 和最近运行；当天未发刊时只触发一次 `publish`，并核验线上内容。第二次执行用于重试或检查，已发刊不会再消费下一期。
- 内容日期按 `Asia/Taipei`（与上海当前同为 UTC+8）计算；入库时间使用实际 UTC 时间。
- Paseo 定时任务依赖本机开机且 Paseo 正在运行；关机或 Paseo 未启动时当次不会执行，需要手动发布。工作流只在 `main` 运行。
- 手动入口：https://github.com/28H2O2/time-space-studio/actions/workflows/daily-publish.yml

## 首轮内容

首轮有 7 期、21 件已收录但尚未进入每日三图的作品，最早发布日期从 2026-10-27 到 2026-11-02。主题包含路线、同步历史、数量与纹样、空间状态变化、几何关系、距离与时间、全景节奏。选图不会增加图像库作品总数，今后也支持包含全新作品的期刊。

`notBefore` 表示最早发布日期，不是必须补发的历史日期。若某天未执行，下次从队首取一期，以实际当天日期发布；不一次集中补发。剩余不超过 2 期时，运行日志会出现 warning；库存耗尽且当天未发刊时，工作流失败并在摘要中说明。GitHub 是否发送失败通知取决于账户通知设置；本流程没有另行创建邮件、聊天通知或 issue。

选图须遵守用户确认的偏好：每期仍为三张，同一天的三张在视觉风格或媒介上明显不同，并持续寻找来源可靠、许可清楚的新风格。具体的读图和来源核验要求见 [内容维护说明](content-workflow.md)。发布程序和上述兜底定时任务不会检索新作品或判断风格；队列由另一个定时任务`replenish-queue-daily`每天北京时间 13:00 补到 7 期，执行手册见 [每日补充发布库存](replenish-queue.md)。该任务同样依赖本机开机和 Paseo 运行，停用方式是在 Paseo 中暂停它。

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

上例仅说明字段，作品 ID 和审核时间必须换成真实值。`approvedBy` 不限定取值（如 `human`、`codex`、`dot`、`droid`），只要求是非空的真实名称，代表本期选图确认者，不覆盖作品本身的写作来源。`approvedAt` 应记录实际确认时间。三个 ID 必须互不重复，且没有出现在已发期刊或其他待发期刊中。

已有作品直接引用 ID，`artworks` 留空。全新作品需要把符合 `src/lib/types.ts` 的完整记录放入本期 `artworks`，图片放入 `content/queue-media/`，文件名与 `imageKey` 一致；每条新增作品都必须被该期引用。新作品在发布时才写入 `library.json`，图片移入 `public/media/`，`addedAt` 更新为实际入库时间，`writing` 原样保留。

队列与待发布图片不会被网站打包展示，但它们在公开 Git 仓库中可见，不能存放私人资料。已发布作品与待发布作品共同进行 ID、图片文件名和图片字节去重。

## 准备与验证

1. 按 `docs/content-workflow.md` 选图、核对来源及许可、实际查看图片并写作。
   地点检查覆盖全部待发作品，不区分新旧入队日期：必须有有效 `locations`，或核验后仍无法填写的 `locationOmission` 记录。两者都缺失会阻止队列检查和发布，不再当作正常隐藏项。
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

停用方式：在 Paseo 中暂停上述定时任务；如需同时禁止手动发布，在 Actions 页面选择此工作流并点击 **Disable workflow**。重新启用后只处理当前日期的一期，不补发全部遗漏日期。

## 飞书群推送

发布并通过线上核验后，工作流用飞书自建应用向指定群发送交互卡片：先发一张概览卡（本期主题、三件作品一览、打开网站与项目仓库按钮），再为每件作品各发一张卡（按类别配色的标题、大图、作者与年代、看点、图像署名，以及网站详情、原始出处、图片许可三个按钮）。每期共 4 条消息。只在本次真正发刊时发送；同日重试不会重复发送，飞书的 `uuid` 去重也会拦住一小时内的相同请求。发送失败只在日志里给出 warning，不会让已核验的发布变成失败。

在仓库 **Settings → Secrets and variables → Actions → Repository secrets** 添加：

| Secret | 内容 |
| --- | --- |
| `FEISHU_APP_ID` | 应用的 App ID |
| `FEISHU_APP_SECRET` | 应用的 App Secret |
| `FEISHU_CHAT_ID` | 目标群的 `chat_id`（形如 `oc_…`） |

可选的 `FEISHU_API_BASE`（默认 `https://open.feishu.cn`）只用于 Lark 国际版等其他域名，需使用 HTTPS。三个 Secret 未配置时，推送步骤会跳过。

前提：应用已发布并启用机器人能力，已加入目标群，并有“以应用身份发消息”（`im:message:send_as_bot`）权限。卡片里的三张图片需要先上传到飞书，因此还需要“获取与上传图片或文件资源”（`im:resource`）权限。使用 `--require-images`（或手动工作流勾选 `require_images`）时，图片上传失败会在发送前直接报错，不会发出任何消息；发送过程中若某张卡失败，日志会写明已发出几张。查找 `chat_id` 时，在本机设置 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 后运行 `node scripts/feishu-notify.mjs --list-chats`；该模式在 GitHub Actions 中被禁用，因为本仓库公开，日志会暴露群名称。

每日发布工作流固定带 `--require-images`，必须三张预览全部上传成功才开始发送；只有不带该参数的手动调用才允许缺图继续。发布兜底任务须分别核查网站上线与飞书发送结果：读取当期日志，确认 `4 card(s), 3 picture(s)`，报告发送失败、跳过或未确认，不能仅凭工作流总体成功认定飞书成功。对当天已经上线的期刊也检查对应发送记录；发现部分发送时报告已发送数量，不自动重发整期。日常通知继续复用地点卡片和预览脚本，不消耗额外期刊、不为检查重复发消息。

手动入口：Actions 中的 **Feishu notification**。`test` 发送连通性测试消息，`latest` 重新播报最新一期；主题没有保存在内容库里，需要主题行时在 `title` 输入框填写。卡片版式可用 `node scripts/feishu-notify.mjs --dry-run` 在本机预览 JSON（图片用占位 key）。

作品卡在作者与年代下方增加浅灰底地点区：收藏地和画中地点纵向排列，机构／地点名称突出显示，地域与地图链接另起一行。版画使用“此印本藏于”；多个画中地点共用标签。地图只根据已核实的 `mapQuery` 生成，没有地点时整块省略。历史范围、想象景观等限定说明完整保留，不因卡片摘要截断。来源与核验日期继续在网站详情及内容记录中维护；收藏地不表示正在展出。地点文字更新会改变消息去重键，可用 `latest` 发送修订版，不消费发布队列。

飞书上传使用内存中生成的等比例预览：JPEG 最长边 2400 px，PNG 最长边 1600 px 并保留透明度，不放大小图、不裁切。上传前检查文件小于 10 MB，网站原图不变。手动通知工作流也执行 `npm ci`，安装图片处理依赖；本地运行通知前同样需要安装项目依赖。

## 官方参考

- [GITHUB_TOKEN 对后续工作流触发的影响](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Vercel GitHub 集成](https://vercel.com/docs/git/vercel-for-github)
- [可选 Vercel Deploy Hook](https://vercel.com/docs/deploy-hooks)
