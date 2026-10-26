# 通过提交更新选图

## 文件约定

- `content/library.json`：`artworks` 是作品全集，`batches` 是往期选图（最新在前），`latestSuccess` 等于最新期的 `createdAt`。该时间表示内容入库时间，实际部署成功时间以 Vercel 为准。
- `public/media/`：只放 `artworks.imageKey` 引用的 JPG / PNG，每张小于 20 MB。避免覆盖旧图；新图用新的稳定文件名。图像会进入公开仓库历史。
- `src/lib/contemporary-references.json`：只提供原站阅读入口的作品，不计入每日三张图。
- `src/lib/types.ts`：完整字段类型；新增作品可参照现有的 `contemporary-ocean-2025` 记录。

## 一期更新

每日定时发布优先使用已审核队列，格式、排期与恢复步骤见 [每日自动发布说明](daily-publishing.md)。下列核验要求同样适用于入队作品；已有但未被每日推荐的作品可直接引用稳定 ID，无需重复收录。

1. 查阅机构、设计师、博物馆或图书馆的一手页面，并实际读图。核实署名、年代、原始出处、使用依据；未知信息明确标为未知。
2. 选 3 件有可靠展示依据的作品，下载获准使用的图片。每周约六成选图聚焦时间、空间与关系，其余留给平面设计、艺术、信息设计和跨媒介作品。
3. 将新作品完整记录加入 `artworks`。ID、文件名保持稳定，重跑时先查 ID、来源和图片内容，不重复添加。明确真实时间、事件顺序、地理空间和拓扑连接的区别。
4. 每件短评包含 `structure`、`borrow`、`application`；`observation` 只记可见事实，`evidence` 记来源核验。不补造作者意图。图片 `rights` 写明署名、许可链接和本次使用方式。
5. 新文字由 dot 撰写时，设置 `writing.author` 为 `dot`，记录 ISO 时间、`referenceSources`；`inputHash` 为来源信息和实际观察输入的 SHA-256。不要伪称调用 Gemini 或猜测具体模型。Codex 撰写则填 `codex`。历史记录保持真实来源。
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
