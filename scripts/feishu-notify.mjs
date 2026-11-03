import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://time-space-studio.vercel.app';

const CATEGORY = { 'time-space': '时空与关系', graphic: '平面设计', art: '艺术作品' };
const REPO = 'https://github.com/28H2O2/time-space-studio';

const clip = (value, max) => {
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  // Prefer ending at a clause boundary over cutting a word in half.
  const boundary = Math.max(...[...'，,；;、/'].map(mark => head.lastIndexOf(mark)));
  return `${(boundary > max * 0.4 ? head.slice(0, boundary) : head).trimEnd()}…`;
};
const firstSentence = value => String(value).split(/(?<=[。！？])/)[0];

export function buildMessage(library, { title = '', site = SITE } = {}) {
  const batch = library.batches[0];
  assert(batch, 'No published issue to announce');
  const works = batch.featuredIds.map(id => {
    const work = library.artworks.find(a => a.id === id);
    assert(work, `Unknown featured work: ${id}`);
    return work;
  });
  const text = (value, style) => ({ tag: 'text', text: value, ...(style && { style }) });
  const link = (label, href) => ({ tag: 'a', text: label, href });
  const lines = [];
  if (title) lines.push([text(`本期主题：${title}`, ['bold'])]);
  works.forEach((work, index) => {
    lines.push([text(`${index + 1}. ${work.title}`, ['bold'])]);
    lines.push([text(`${work.creator} · ${work.year} · ${CATEGORY[work.category] || work.category}`)]);
    lines.push([text(`看点：${clip(firstSentence(work.analysis.structure), 90)}`)]);
    lines.push([text(`图像：${clip(work.rights.credit, 110)}`)]);
    lines.push([
      text('相关链接：'),
      link('网站详情', `${site}/?view=today&work=${encodeURIComponent(work.id)}`), text(' · '),
      link('原始出处', work.sourceUrl), text(' · '),
      link('图片许可', work.rights.url),
    ]);
  });
  lines.push([text('每件作品的来源核验与许可说明见网站详情页的“来源与使用说明”。')]);
  lines.push([link('打开今日选图', site), text(' · '), link('项目仓库', REPO)]);
  return {
    batchId: batch.id,
    content: { zh_cn: { title: `时空图像研究室 · ${batch.date} 每日选图`, content: lines } },
  };
}

async function request(fetchImpl, url, init, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15000) });
      if (response.status >= 500 && attempt < attempts) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

async function json(response, what) {
  let body;
  try { body = await response.json(); } catch { throw new Error(`${what}: unreadable response (HTTP ${response.status})`); }
  if (!response.ok || body.code !== 0) throw new Error(`${what}: HTTP ${response.status}, code ${body.code}, ${String(body.msg || '').slice(0, 200)}`);
  return body;
}

export async function tenantToken({ appId, appSecret, base = 'https://open.feishu.cn', fetchImpl = fetch }) {
  const response = await request(fetchImpl, `${base}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const body = await json(response, 'Feishu token request');
  assert(typeof body.tenant_access_token === 'string' && body.tenant_access_token, 'Feishu token response has no token');
  return body.tenant_access_token;
}

export async function sendPost({ appId, appSecret, chatId, base = 'https://open.feishu.cn', fetchImpl = fetch, content, dedupeKey }) {
  const token = await tenantToken({ appId, appSecret, base, fetchImpl });
  // The uuid makes Feishu drop an identical send within an hour, so a retry cannot double-post.
  const uuid = createHash('sha256').update(`${dedupeKey}:${chatId}`).digest('hex').slice(0, 32);
  const response = await request(fetchImpl, `${base}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receive_id: chatId, msg_type: 'post', content: JSON.stringify(content), uuid }),
  });
  return (await json(response, 'Feishu send message')).data?.message_id;
}

export async function listChats({ appId, appSecret, base = 'https://open.feishu.cn', fetchImpl = fetch }) {
  const token = await tenantToken({ appId, appSecret, base, fetchImpl });
  const response = await request(fetchImpl, `${base}/open-apis/im/v1/chats?page_size=50`, { headers: { Authorization: `Bearer ${token}` } });
  return ((await json(response, 'Feishu chat list')).data?.items || []).map(chat => ({ chat_id: chat.chat_id, name: chat.name }));
}

function config(env) {
  const { FEISHU_APP_ID: appId, FEISHU_APP_SECRET: appSecret, FEISHU_CHAT_ID: chatId } = env;
  const base = env.FEISHU_API_BASE || 'https://open.feishu.cn';
  assert(new URL(base).protocol === 'https:', 'FEISHU_API_BASE must use HTTPS');
  return { appId, appSecret, chatId, base, complete: Boolean(appId && appSecret && chatId) };
}

async function main(argv, env) {
  const modes = ['--latest', '--test', '--dry-run', '--list-chats'];
  const mode = argv.find(arg => modes.includes(arg));
  assert(mode, `Use one of ${modes.join(', ')}`);
  const titleIndex = argv.indexOf('--title');
  const title = titleIndex >= 0 ? (argv[titleIndex + 1] || '').replace(/\s+/g, ' ').trim() : '';
  const library = JSON.parse(readFileSync(fileURLToPath(new URL('../content/library.json', import.meta.url)), 'utf8'));

  if (mode === '--dry-run') {
    console.log(JSON.stringify(buildMessage(library, { title }).content, null, 2));
    return;
  }
  const cfg = config(env);
  if (mode === '--list-chats') {
    // Group names and IDs must not end up in public workflow logs.
    assert(!env.GITHUB_ACTIONS, '--list-chats is for local use only');
    assert(cfg.appId && cfg.appSecret, 'Set FEISHU_APP_ID and FEISHU_APP_SECRET');
    console.table(await listChats(cfg));
    return;
  }
  if (!cfg.complete) {
    if (mode === '--test') throw new Error('Set FEISHU_APP_ID, FEISHU_APP_SECRET and FEISHU_CHAT_ID first.');
    console.log('::notice::Feishu is not configured; skipping the group notification.');
    return;
  }
  if (mode === '--test') {
    const stamp = new Date().toISOString();
    const content = { zh_cn: { title: '时空图像研究室 · 推送连通性测试', content: [[{ tag: 'text', text: `这是一条测试消息，说明机器人可以向本群发送每日选图。\n${stamp}` }]] } };
    await sendPost({ ...cfg, content, dedupeKey: `test:${stamp}` });
    console.log('Feishu test message sent.');
    return;
  }
  const { batchId, content } = buildMessage(library, { title });
  await sendPost({ ...cfg, content, dedupeKey: batchId });
  console.log(`Feishu notification sent for ${batchId}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2), process.env).catch(error => {
    console.log(`::warning::Feishu notification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
