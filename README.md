# 时空图像研究室

一个公开的图像学习网站：每日选图、参考图像库、独立缩放的并排对照，以及保存在浏览器里的收藏和笔记。

当前收录 **48 件参考图像、9 件当代设计原站链接、7 期选图**。每张图保留作者、年代、原始出处、使用说明和中文短拆解。此仓库不包含个人生成图片、个人图像记录、个人笔记或旧站的服务端配置。

## 部署到 Vercel

1. 在 Vercel 中选择 **Add New → Project**，导入 `28H2O2/time-space-studio`。
2. Framework 选 **Vite**；Root Directory 留空或 `.`。
3. Build Command：`npm run build`；Output Directory：`dist`；Node.js：**22.x**。
4. 无需环境变量、数据库、对象存储或登录密钥。点击 Deploy。
5. 用退出登录的浏览器检查生产域名。本站没有登录门槛；如果 Vercel 自己显示身份验证，请检查项目的 Deployment Protection 设置及正在访问的是否为生产域名。

仓库包含 `vercel.json`，通常无需修改默认配置。连接 GitHub 后，推送到 `main` 会触发新的生产构建。详见 [Vercel Git 集成](https://vercel.com/docs/git) 与 [Vite 部署说明](https://vite.dev/guide/static-deploy.html#vercel)。

## 日常更新

内容在 `content/library.json`，图像在 `public/media/`，当代设计原站条目在 `src/lib/contemporary-references.json`。

```sh
npm ci
npm run dev
# 修改内容并添加对应图像
npm run check
npm run build
git add content/library.json public/media/ src/lib/contemporary-references.json
git commit -m "content: add daily selection YYYY-MM-DD"
git push origin main
```

构建会检查重复 ID、重复图片、缺失来源、图像文件、三图期刊和常见私人配置。检查不能替代人工核对作者、事实、读图观察和版权许可。

[内容维护说明](docs/content-workflow.md) · [可发给 dot 的维护提示词](docs/dot-handoff.md)

GitHub Actions 负责每次提交的检查与构建；**本仓库没有设置定时采集任务**。每日内容需要人或有仓库权限的 agent 先完成选图并提交。Vercel 自动部署和定时生成内容是两个独立步骤。

## 收藏与笔记

数据只写入当前浏览器、当前域名的 localStorage，不上传服务器。每位访客的记录相互独立；清理浏览数据或换域名不会自动迁移。部署前后的域名不同，需要手动导出／导入。

- “我的笔记”可导出 JSON（完整备份）或 Markdown（阅读版）。
- 导入只支持本站格式的 JSON，最大 5 MB；按 ID 合并，同一记录保留更新时间较新的版本，时间相同保留当前版本。
- 未在当前图像库出现的笔记仍保留在备份里，不会因换图而被删除。
- 收藏与喜欢分别记录，可以“不喜欢但收藏”。
- 删除方法笔记后再导入旧备份，会将该方法笔记恢复。

## 技术与权限

Vite + React + TypeScript；构建结果为 `dist/` 下的静态网站。没有 Sites、D1、R2 或在线模型调用依赖。历史短评保留真实写作来源；后续可由 dot 撰写，不要求 Gemini，也不推断 dot 背后的模型。

网站代码与收录的图像不共享一份版权许可。图像权利见每件作品的 `rights` 字段和原站；其中包含署名、相同方式共享及非商业限制，不应将整个图像库宣称为可任意商用。没有可靠展示许可的当代作品仅保留原站入口。
