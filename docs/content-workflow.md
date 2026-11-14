# 通过提交更新选图

## 文件约定

- `content/library.json`：`artworks` 是作品全集，`batches` 是往期选图（最新在前），`latestSuccess` 等于最新期的 `createdAt`。该时间表示内容入库时间，实际部署成功时间以 Vercel 为准。
- `public/media/`：只放 `artworks.imageKey` 引用的 JPG / PNG，每张小于 20 MB。避免覆盖旧图；新图用新的稳定文件名。图像会进入公开仓库历史。
- `src/lib/contemporary-references.json`：只提供原站阅读入口的作品，不计入每日三张图。
- `content/library.en.json`：英文版文字，以作品 ID 为键，只放需要翻译的字段：`title`、`creator`、`year`、`methods`、`topics`、`evidence`、`analysis`，以及含中文的 `rights` 字段（`label`、`credit`、`usage`）。缺少某个字段或整条记录时，英文界面回退到中文原文，所以新作品不翻译也不会出错；`npm run check` 会列出尚无英文的作品。`methods` 与 `topics` 的数量必须与中文记录一致，筛选才不会混用两种语言。每日自动发布只写入中文记录，英文需随后补充。
- `src/lib/contemporary-references.en.json`：原站条目的英文版，以条目 ID 为键，每条都必须有，否则检查失败。
- `src/lib/copy.zh.json` / `src/lib/copy.en.json`：界面文字，两份的键必须一致（测试会核对）。
- `src/lib/types.ts`：完整字段类型；新增作品可参照现有的 `contemporary-ocean-2025` 记录。

## 地点资料

作品可选填 `locations.collection`（收藏地）和 `locations.depicted`（画中地点数组）。网站详情页及飞书作品卡展示；缺项不显示。每个地点包含稳定 `id`、`name`、`sourceUrl`、`checkedAt`（YYYY-MM-DD）和 `verification`；可选 `region`、`note`、`mapQuery`。收藏地的 `isImpression: true` 表示本站所用印本，界面显示“此印本藏于”。

- `verification: "source"` 表示本轮实际查阅了支持该地点的一手资料；`"catalogue-record"` 表示复核本站已有 `evidence` 和 `rights.credit` 中的具体馆藏记录。`checkedAt` 是这次复核日期，不代表官网一定在当天可访问，也不表示正在展出。不要只按来源域名推断收藏地。
- 收藏地对应图片所代表的实物或印本；图片托管站、制作地、出版地和作者籍贯不能替代收藏地或画中地点。数字作品无需填实体收藏地。未核实的地点直接省略，不填“未知”占位。
- 画中地点可记录多个地点或地区范围。历史地名、约略范围和想象景观保留限定说明；无法对应现代地点时省略 `mapQuery`。地图、图表可以注明所绘地区，抽象图形和纹样不推断具体地点。
- `mapQuery` 使用明确的“地点名、城市、国家”，需要时加地址；前端统一编码为 Google Maps 搜索链接。它表示查询目标，不是精确拍摄机位，也不保证当前可参观。地点名称链接到资料来源，旁边的“地图”单独跳转。
- 英文文件增加 `locations.collection: { name?, region?, note? }` 和 `locations.depicted: { "地点id": { name?, region?, note? } }`。只覆盖文字，缺译按字段回退；不翻译或覆盖来源、地图查询词、核验日期及印本标记。地点 ID 保持稳定，不能用数组位置关联译文。
- 新入队和已有待发作品都必须逐件检查收藏地和画中地点，有可靠资料就填写；字段可缺省不代表可跳过核验。不能核实或不适用时省略对应字段，并在本次任务汇报中说明原因，不另建清单文件。没有任何地点的待发作品必须提供 `locationOmission: { checkedAt: "YYYY-MM-DD", reason: "核验后两类地点均无法填写的具体原因", sourceUrls: ["实际核查的 HTTPS 来源"] }`；不能用空对象或“未知”占位绕过检查，也不能与 `locations` 同时填写。它是编辑核验记录，不显示为地点，不需要翻译。`npm run check` 和发布程序对全部待发期刊执行此检查，包括复用已入库作品；已发布的历史记录仍兼容缺项。修改地点不改历史短评的写作来源或入库时间。

## 一期更新

每日定时发布优先使用已审核队列，格式、排期与恢复步骤见 [每日自动发布说明](daily-publishing.md)。下列核验要求同样适用于入队作品；已有但未被每日推荐的作品可直接引用稳定 ID，无需重复收录。

1. 查阅机构、设计师、博物馆或图书馆的一手页面，并实际读图。核实署名、年代、原始出处、使用依据；未知信息明确标为未知。
2. 选 3 件有可靠展示依据的作品，下载获准使用的图片。同一天的三张应呈现明显不同的视觉风格或媒介，例如历史信息图、摄影、版画、绘画、海报和织物；不要把同一系列或外观相近的图放在同一天。定期寻找尚未入库的新风格，跨期避免反复依赖同一种作者、年代和画面语言。每周约六成选图聚焦时间、空间与关系，其余留给平面设计、艺术、信息设计和跨媒介作品。
3. 将新作品完整记录加入 `artworks`。ID、文件名保持稳定，重跑时先查 ID、来源和图片内容，不重复添加。明确真实时间、事件顺序、地理空间和拓扑连接的区别。
4. 每件短评包含 `structure`、`borrow`、`application`；`observation` 只记可见事实，`evidence` 记来源核验。不补造作者意图。图片 `rights` 写明署名、许可链接和本次使用方式。
5. 新文字设置 `writing.author` 为实际撰写者的名称（不限定取值，如 `dot`、`codex`、`droid`，不得为空），记录 ISO 时间、`referenceSources`；`inputHash` 为来源信息和实际观察输入的 SHA-256。不要伪称调用 Gemini 或猜测具体模型，也不要借用其他撰写者的名字。历史记录保持真实来源。
6. 在 `batches` 开头加入一条记录，例如：

```json
{
  "id": "daily-YYYY-MM-DD",
  "date": "YYYY-MM-DD",
  "featuredIds": ["first-work-id", "second-work-id", "third-work-id"],
  "status": "published",
  "count": 3,
  "createdAt": "替换为本次 ISO 时间"
}
```

7. `date` 使用 Asia/Taipei 日期；`createdAt` 使用实际 ISO 时间，并同步 `latestSuccess`。不因遗漏日期而集中补发。
8. 执行 `npm run check && npm run build`，在本地检查三张图、详情来源和手机布局。检查 Git diff 仅含本期内容、图片和必要的专题变动。提交并推送到 `main`。
9. 分别确认 GitHub Actions 和 Vercel 部署结果。构建失败时修复后提交；离线或权限不足时保留未提交文件并报告，不把准备完成称为已发布。

## 公开范围

不要提交私人图片、笔记备份、截图中的个人信息、账号信息、令牌、`.env` 或本地服务配置。个人笔记不属于内容采集流程，自动维护不能将推测偏好写为用户已确认规则。

如果需要撤回公开内容，普通删除提交只影响当前版本，历史中仍有文件；因此每次提交前都要检查将公开的内容。
