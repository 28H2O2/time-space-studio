import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://time-space-studio.vercel.app';
const REPO = 'https://github.com/28H2O2/time-space-studio';
const API = 'https://open.feishu.cn';

const CATEGORY = {
  'time-space': { label: '时空与关系', color: 'blue' },
  graphic: { label: '平面设计', color: 'orange' },
  art: { label: '艺术作品', color: 'purple' },
};

const clip = (value, max) => {
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  // Prefer ending at a clause boundary over cutting a word in half.
  const boundary = Math.max(...[...'，,；;、/'].map(mark => head.lastIndexOf(mark)));
  return `${(boundary > max * 0.4 ? head.slice(0, boundary) : head).trimEnd()}…`;
};
const firstSentence = value => String(value).split(/(?<=[。！？])/)[0];
// Card markdown would otherwise read these characters in titles or credits as formatting.
const safe = value => String(value).replace(/[<>*`[\]]/g, ch => ({ '<': '＜', '>': '＞', '*': '＊', '`': '’', '[': '［', ']': '］' })[ch]);

const plain = content => ({ tag: 'plain_text', content });
const markdown = (content, extra = {}) => ({ tag: 'markdown', content, ...extra });
const button = (label, url, type = 'default') => ({
  tag: 'column', width: 'auto', elements: [{ tag: 'button', text: plain(label), type, size: 'medium', behaviors: [{ type: 'open_url', default_url: url }] }],
});
const buttons = items => ({ tag: 'column_set', flex_mode: 'flow', horizontal_spacing: '8px', columns: items.map(([label, url, type]) => button(label, url, type)) });
const card = (header, elements) => ({
  schema: '2.0',
  config: { width_mode: 'fill' },
  header,
  body: { direction: 'vertical', padding: '12px', elements },
});

// A single full-width panel stays legible on mobile, including long institution names.
// Preserve qualifiers in full: truncating a note could turn an approximate location into a claim.
function locationPanel(locations) {
  const elements = [];
  function group(label, places) {
    if (!places?.length) return;
    elements.push(markdown(`<font color='grey'>📍 ${label}</font>`, { margin: elements.length ? '10px 0px 0px 0px' : '0px' }));
    for (const place of places) {
      const map = place.mapQuery?.trim()
        ? `[地图 ↗](https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: place.mapQuery })})`
        : '';
      const region = place.region ? safe(place.region) : '';
      const lines = [`**${safe(place.name)}**`, [region, map].filter(Boolean).join('　')];
      if (place.note) lines.push(`<font color='grey'>${safe(place.note)}</font>`);
      elements.push(markdown(lines.filter(Boolean).join('\n'), { margin: '2px 0px 0px 0px' }));
    }
  }
  if (locations?.collection) group(locations.collection.isImpression ? '此印本藏于' : '收藏地', [locations.collection]);
  group('画中地点', locations?.depicted);
  return elements.length ? [{
    tag: 'column_set', flex_mode: 'none', margin: '8px 0px',
    columns: [{ tag: 'column', width: 'weighted', weight: 1, background_style: 'grey-50', padding: '12px', elements }],
  }] : [];
}

// `images` maps a work id to the image_key Feishu returned for its uploaded picture.
// Returns one overview card followed by one card per work, in the order they should be sent.
export function buildMessages(library, { title = '', site = SITE, images = {} } = {}) {
  const batch = library.batches[0];
  assert(batch, 'No published issue to announce');
  const works = batch.featuredIds.map(id => {
    const work = library.artworks.find(a => a.id === id);
    assert(work, `Unknown featured work: ${id}`);
    return work;
  });

  const overview = card(
    { title: plain('时空图像研究室 · 每日选图'), subtitle: plain(batch.date), template: 'indigo' },
    [
      ...(title ? [markdown(`**${safe(title)}**`, { text_size: 'heading' })] : []),
      markdown(works.map((work, index) => `${index + 1}. **${safe(work.title)}**\n<font color='grey'>${safe(work.creator)} · ${safe(work.year)}</font>`).join('\n\n')),
      { tag: 'hr' },
      markdown('每件作品的来源核验与许可说明见网站详情页的“来源与使用说明”。', { text_size: 'notation' }),
      buttons([['打开今日选图', site, 'primary'], ['项目仓库', REPO]]),
    ],
  );

  const cards = works.map((work, index) => {
    const category = CATEGORY[work.category] || { label: work.category, color: 'grey' };
    return card(
      {
        title: plain(`今日选图 ${index + 1} / ${works.length}`),
        subtitle: plain(batch.date),
        template: category.color,
        text_tag_list: [{ tag: 'text_tag', text: plain(category.label), color: category.color }],
      },
      [
        ...(images[work.id] ? [{ tag: 'img', img_key: images[work.id], alt: plain(work.title), corner_radius: '8px', scale_type: 'fit_horizontal', preview: true, margin: '0px 0px 8px 0px' }] : []),
        markdown(`**${safe(work.title)}**`, { text_size: 'heading' }),
        markdown(`<font color='grey'>${safe(work.creator)} · ${safe(work.year)}</font>`),
        ...locationPanel(work.locations),
        markdown(`**看点**　${safe(clip(firstSentence(work.analysis.structure), 90))}`, { margin: '8px 0px 0px 0px' }),
        markdown(`图像：${safe(clip(work.rights.credit, 110))}`, { text_size: 'notation', margin: '4px 0px 8px 0px' }),
        buttons([
          ['网站详情', `${site}/?view=today&work=${encodeURIComponent(work.id)}`, 'primary'],
          ['原始出处', work.sourceUrl],
          ['图片许可', work.rights.url],
        ]),
      ],
    );
  });
  return { batchId: batch.id, cards: [overview, ...cards] };
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
  if (!response.ok || body.code !== 0) throw new Error(`${what}: HTTP ${response.status}, code ${body.code}, ${String(body.msg || '').slice(0, 300)}`);
  return body;
}

export async function tenantToken({ appId, appSecret, base = API, fetchImpl = fetch }) {
  const response = await request(fetchImpl, `${base}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const body = await json(response, 'Feishu token request');
  assert(typeof body.tenant_access_token === 'string' && body.tenant_access_token, 'Feishu token response has no token');
  return body.tenant_access_token;
}

export async function uploadImage({ token, base = API, fetchImpl = fetch, bytes, filename }) {
  const form = new FormData();
  form.append('image_type', 'message');
  form.append('image', new Blob([bytes], { type: filename.endsWith('.png') ? 'image/png' : 'image/jpeg' }), filename);
  const response = await request(fetchImpl, `${base}/open-apis/im/v1/images`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const body = await json(response, 'Feishu image upload');
  assert(typeof body.data?.image_key === 'string' && body.data.image_key, 'Feishu image upload returned no image_key');
  return body.data.image_key;
}

export async function sendMessage({ appId, appSecret, chatId, base = API, fetchImpl = fetch, msgType, content, dedupeKey, token }) {
  token ??= await tenantToken({ appId, appSecret, base, fetchImpl });
  // The uuid makes Feishu drop an identical send within an hour, so a retry cannot double-post.
  const uuid = createHash('sha256').update(`${dedupeKey}:${chatId}`).digest('hex').slice(0, 32);
  const response = await request(fetchImpl, `${base}/open-apis/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receive_id: chatId, msg_type: msgType, content: JSON.stringify(content), uuid }),
  });
  return (await json(response, 'Feishu send message')).data?.message_id;
}

// Uploads each featured picture, then posts the overview card and one card per work. A picture that
// cannot be uploaded is left out (the text still goes out) unless `requireImages` is set, in which
// case nothing is sent.
export async function announce({ appId, appSecret, chatId, base, fetchImpl = fetch, library, title, readImage, requireImages = false, log = console.log }) {
  const token = await tenantToken({ appId, appSecret, base, fetchImpl });
  const batch = library.batches[0];
  assert(batch, 'No published issue to announce');
  const images = {};
  for (const id of batch.featuredIds) {
    const work = library.artworks.find(a => a.id === id);
    try {
      assert(work, `Unknown featured work: ${id}`);
      images[id] = await uploadImage({ token, base, fetchImpl, bytes: readImage(work), filename: work.imageKey });
    } catch (error) {
      if (requireImages) throw error;
      log(`::warning::Image for ${id} was not attached: ${error.message}`);
    }
  }
  const { batchId, cards } = buildMessages(library, { title, images });
  let sent = 0;
  for (const [index, content] of cards.entries()) {
    // Keyed by content so a corrected re-send is not swallowed by Feishu's one-hour duplicate filter.
    const dedupeKey = `${batchId}:${index}:${createHash('sha256').update(JSON.stringify(content)).digest('hex')}`;
    try {
      await sendMessage({ appId, appSecret, chatId, base, fetchImpl, token, msgType: 'interactive', content, dedupeKey });
    } catch (error) {
      throw new Error(`message ${index + 1} of ${cards.length} failed after ${sent} sent: ${error.message}`);
    }
    sent++;
  }
  return { batchId, attached: Object.keys(images).length, sent };
}

export async function listChats({ appId, appSecret, base = API, fetchImpl = fetch }) {
  const token = await tenantToken({ appId, appSecret, base, fetchImpl });
  const response = await request(fetchImpl, `${base}/open-apis/im/v1/chats?page_size=50`, { headers: { Authorization: `Bearer ${token}` } });
  return ((await json(response, 'Feishu chat list')).data?.items || []).map(chat => ({ chat_id: chat.chat_id, name: chat.name }));
}

function config(env) {
  const { FEISHU_APP_ID: appId, FEISHU_APP_SECRET: appSecret, FEISHU_CHAT_ID: chatId } = env;
  const base = env.FEISHU_API_BASE || API;
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
    const placeholders = Object.fromEntries(library.batches[0].featuredIds.map(id => [id, `img_${id}`]));
    console.log(JSON.stringify(buildMessages(library, { title, images: placeholders }).cards, null, 2));
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
    const content = card(
      { title: plain('时空图像研究室 · 推送连通性测试'), template: 'grey' },
      [markdown(`这是一条测试消息，说明机器人可以向本群发送每日选图。\n<font color='grey'>${stamp}</font>`)],
    );
    await sendMessage({ ...cfg, msgType: 'interactive', content, dedupeKey: `test:${stamp}` });
    console.log('Feishu test message sent.');
    return;
  }
  const mediaDir = fileURLToPath(new URL('../public/media/', import.meta.url));
  const { batchId, attached, sent } = await announce({
    ...cfg, library, title, requireImages: argv.includes('--require-images'),
    readImage: work => readFileSync(join(mediaDir, work.imageKey)),
  });
  console.log(`Feishu notification sent for ${batchId}: ${sent} card(s), ${attached} picture(s).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2), process.env).catch(error => {
    console.log(`::warning::Feishu notification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
