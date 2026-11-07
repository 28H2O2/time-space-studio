# 时空图像研究室 · Time-Space Image Lab

**中文** · [English](#english)

---

## 中文

一个公开的图像学习网站：每日选图、参考图像库、独立缩放的并排对照，以及保存在浏览器里的收藏和笔记。

网站有中文和英文两个版本。点击页面右上角的语言按钮即可切换，选择会记在当前浏览器里；首次访问时按浏览器语言选择，也可以用 `/?lang=en` 或 `/?lang=zh` 直接打开指定语言。英文版覆盖界面文字、作品标题、作者、年代、方法标签、短评、来源核验和使用说明，以及“当代观察”原站条目。尚未翻译的新作品在英文界面下暂时显示中文原文。

图像库规模和最新期刊以网站首页为准。每张图保留作者、年代、原始出处、使用说明和中文短拆解（另有英文版）。此仓库不包含个人生成图片、个人图像记录、个人笔记或旧站的服务端配置。

### 部署到 Vercel

1. 在 Vercel 中选择 **Add New → Project**，导入 `28H2O2/time-space-studio`。
2. Framework 选 **Vite**；Root Directory 留空或 `.`。
3. Build Command：`npm run build`；Output Directory：`dist`；Node.js：**22.x**。
4. 无需环境变量、数据库、对象存储或登录密钥。点击 Deploy。
5. 用退出登录的浏览器检查生产域名。本站没有登录门槛；如果 Vercel 自己显示身份验证，请检查项目的 Deployment Protection 设置及正在访问的是否为生产域名。

仓库包含 `vercel.json`，通常无需修改默认配置。连接 GitHub 后，推送到 `main` 会触发新的生产构建。详见 [Vercel Git 集成](https://vercel.com/docs/git) 与 [Vite 部署说明](https://vite.dev/guide/static-deploy.html#vercel)。

### 日常更新

内容在 `content/library.json`，图像在 `public/media/`，当代设计原站条目在 `src/lib/contemporary-references.json`。英文版在 `content/library.en.json` 和 `src/lib/contemporary-references.en.json`，界面文字在 `src/lib/copy.zh.json` 与 `src/lib/copy.en.json`。

```sh
npm ci
npm run dev
# 修改内容并添加对应图像，同时补充 content/library.en.json 中的英文
npm run check
npm run build
git add content/library.json content/library.en.json public/media/ src/lib/contemporary-references.json
git commit -m "content: add daily selection YYYY-MM-DD"
git push origin main
```

构建会检查重复 ID、重复图片、缺失来源、图像文件、三图期刊和常见私人配置，并核对英文版：英文条目必须对应现有作品，原站条目必须全部有英文，两份界面文字的键必须一致。尚无英文的作品只会列出提示，不会让构建失败。检查不能替代人工核对作者、事实、读图观察和版权许可。

[内容维护说明](docs/content-workflow.md) · [可发给 dot 的维护提示词](docs/dot-handoff.md)

本机 Paseo 定时任务每天北京时间 **08:00** 触发 GitHub Actions，从已审核队列发布一期，**11:00** 再检查一次；同日已有期刊时不重复发布。电脑关机或 Paseo 未运行时不会触发，需要手动发布。每次运行均检查内容、测试和构建，并核验正式网站的内容指纹及三张图片。

待发布队列在 `content/publication-queue.json`，新增作品的待发布图片放在 `content/queue-media/`。首轮排期为 2026-10-27 至 2026-11-02，使用现有库中尚未进入每日三图的 21 件作品。这个流程自动发布已准备的内容，**不会自行检索或撰写新作品**，也**不会自动翻译**：自动发布的新作品先以中文上线，英文需随后补充到 `content/library.en.json`。队列需要持续补充。无需模型 API 密钥。

可在 Actions 的 **Publish daily selection → Run workflow** 中选择 `rehearse` 演练下一期（仅生成构建产物）或 `publish` 执行当天发布。详见 [每日自动发布说明](docs/daily-publishing.md)。

### 收藏与笔记

数据只写入当前浏览器、当前域名的 localStorage，不上传服务器。每位访客的记录相互独立；清理浏览数据或换域名不会自动迁移。部署前后的域名不同，需要手动导出／导入。

- “我的笔记”可导出 JSON（完整备份）或 Markdown（阅读版，标题和标签随当前界面语言）。
- 导入只支持本站格式的 JSON，最大 5 MB；按 ID 合并，同一记录保留更新时间较新的版本，时间相同保留当前版本。
- 未在当前图像库出现的笔记仍保留在备份里，不会因换图而被删除。
- 收藏与喜欢分别记录，可以“不喜欢但收藏”。
- 删除方法笔记后再导入旧备份，会将该方法笔记恢复。
- 你写下的笔记和标签保持原样，不会随界面语言翻译。

### 技术与权限

Vite + React + TypeScript；构建结果为 `dist/` 下的静态网站。没有 Sites、D1、R2 或在线模型调用依赖。历史短评保留真实写作来源；后续可由 dot 撰写，不要求 Gemini，也不推断 dot 背后的模型。英文版文字是对中文短评的翻译，不改变其事实判断。

网站代码与收录的图像不共享一份版权许可。图像权利见每件作品的 `rights` 字段和原站；其中包含署名、相同方式共享及非商业限制，不应将整个图像库宣称为可任意商用。没有可靠展示许可的当代作品仅保留原站入口。

---

## English

[中文](#中文) · **English**

A public image-study site: a daily selection, a reference image library, side-by-side comparison with independent zoom, and favorites and notes kept in your own browser.

The site comes in Chinese and English. Use the language button at the top right to switch. Your choice is remembered in the current browser. On a first visit the site follows your browser language, and you can open a specific language directly with `/?lang=en` or `/?lang=zh`. The English version covers the interface, work titles, creators, dates, method tags, short readings, source checks and usage notes, and the "Contemporary Notes" entries that link to creators' own sites. A newly published work that has not been translated yet shows its Chinese text in the English interface.

The library size and the latest issue are shown on the home page. Every image keeps its creator, date, original source, usage note and a short reading (in Chinese, with an English version). This repository contains no personally generated images, personal image records, personal notes or server configuration from the old site.

### Deploying to Vercel

1. In Vercel, choose **Add New → Project** and import `28H2O2/time-space-studio`.
2. Set Framework to **Vite** and leave Root Directory empty or `.`.
3. Build Command: `npm run build`. Output Directory: `dist`. Node.js: **22.x**.
4. No environment variables, database, object storage or login secrets are needed. Click Deploy.
5. Check the production domain in a signed-out browser. The site has no login. If Vercel itself asks for authentication, check the project's Deployment Protection settings and make sure you are visiting the production domain.

The repository includes `vercel.json`, so the default settings usually need no change. Once GitHub is connected, a push to `main` triggers a new production build. See [Vercel Git integration](https://vercel.com/docs/git) and the [Vite deployment guide](https://vite.dev/guide/static-deploy.html#vercel).

### Updating content

Content lives in `content/library.json`, images in `public/media/`, and the contemporary-design entries that link to creators' sites in `src/lib/contemporary-references.json`. The English text is in `content/library.en.json` and `src/lib/contemporary-references.en.json`. Interface strings are in `src/lib/copy.zh.json` and `src/lib/copy.en.json`.

```sh
npm ci
npm run dev
# Edit content and add the matching images, and add the English text to content/library.en.json
npm run check
npm run build
git add content/library.json content/library.en.json public/media/ src/lib/contemporary-references.json
git commit -m "content: add daily selection YYYY-MM-DD"
git push origin main
```

The build checks for duplicate IDs, duplicate images, missing sources, image files, three-image issues and common private configuration. It also checks the English text: each English entry must match an existing work, every external entry must have an English version, and the two interface files must have the same keys. A work with no English yet is listed as a notice and does not fail the build. These checks do not replace a human check of creators, facts, observations and copyright permission.

[Content workflow](docs/content-workflow.md) · [Maintenance prompt for dot](docs/dot-handoff.md) (both in Chinese)

A local Paseo schedule triggers GitHub Actions at **08:00** Beijing time every day to publish one issue from the reviewed queue, and checks again at **11:00**. It does not publish twice if the day already has an issue. Nothing runs when the computer is off or Paseo is not running, so publish by hand in that case. Every run checks content, tests and the build, then verifies the live site's content fingerprint and the three images.

The publishing queue is `content/publication-queue.json`. Images for new works waiting to be published go in `content/queue-media/`. The first round covers 2026-10-27 to 2026-11-02, using 21 works in the current library that had not yet appeared in a daily set of three. The workflow publishes content that is already prepared. It **does not search for or write new works on its own**, and it **does not translate**: a work published automatically goes live in Chinese first, and its English text must be added to `content/library.en.json` afterwards. The queue needs regular refilling. No model API key is required.

In Actions, choose **Publish daily selection → Run workflow** and pick `rehearse` to rehearse the next issue (it only produces build artifacts) or `publish` to publish today's issue. See [Daily publishing](docs/daily-publishing.md) (in Chinese).

### Favorites and notes

Data is written only to localStorage for the current browser and domain. Nothing is uploaded to a server. Each visitor's records are independent. Clearing browsing data or changing domains does not migrate them, so if the domain differs before and after deployment, export and import by hand.

- "My notes" exports JSON (a full backup) or Markdown (a reading copy whose headings and labels follow the current interface language).
- Import accepts only JSON in this site's format, up to 5 MB. Records merge by ID. For the same record, the version with the newer update time is kept, and on a tie the current version stays.
- Notes for works that are not in the current library stay in the backup and are not deleted when images change.
- Favorites and likes are recorded separately, so you can dislike something and still save it.
- Importing an old backup after deleting a method note restores that note.
- The notes and tags you write stay exactly as written. They are not translated with the interface.

### Technology and rights

Vite + React + TypeScript. The build output is a static site in `dist/`. There is no dependency on Sites, D1, R2 or online model calls. Earlier short readings keep their true writing source. New ones may be written by dot, without requiring Gemini or guessing which model is behind dot. The English text translates the Chinese readings and does not change their judgments.

The site code and the images it includes do not share one copyright license. Image rights are in each work's `rights` field and on the original site. They include attribution, share-alike and non-commercial terms, so the whole library must not be described as free for any commercial use. Contemporary works without a reliable display license keep only a link to the creator's site.
