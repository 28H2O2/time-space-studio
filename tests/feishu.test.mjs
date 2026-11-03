import test from 'node:test';
import assert from 'node:assert/strict';
import { announce, buildMessage, sendPost, tenantToken } from '../scripts/feishu-notify.mjs';

const work = (id, title, creator, year, category) => ({
  id, title, creator, year, category, imageKey: `${id}.jpg`, sourceUrl: `https://museum.example/${id}`,
  rights: { credit: `${creator} / 某馆藏`, url: `https://museum.example/rights/${id}` },
  analysis: { structure: `${title}的结构。第二句不应出现。`, borrow: '借鉴', application: '应用' },
});
const library = {
  artworks: [
    work('a', '作品甲', '作者甲', '1800', 'time-space'),
    work('b', '作品乙', '作者乙', '1900', 'graphic'),
    work('c', '作品丙', '作者丙', '2000', 'art'),
    work('old', '旧作', '旧', '1700', 'art'),
  ],
  batches: [
    { id: 'daily-2026-11-04', date: '2026-11-04', featuredIds: ['a', 'b', 'c'] },
    { id: 'daily-2026-11-03', date: '2026-11-03', featuredIds: ['old', 'a', 'b'] },
  ],
};

function fakeFetch(handlers) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    const handler = handlers.find(h => String(url).includes(h.match));
    assert(handler, `Unexpected request: ${url}`);
    return new Response(JSON.stringify(handler.body), { status: handler.status || 200 });
  };
  return { impl, calls };
}

test('message announces the latest issue with its theme, notes and links for each work', () => {
  const { batchId, content } = buildMessage(library, { title: '主题' });
  assert.equal(batchId, 'daily-2026-11-04');
  assert.match(content.zh_cn.title, /2026-11-04/);
  const text = JSON.stringify(content);
  for (const word of ['本期主题：主题', '作品甲', '作者乙 · 1900 · 平面设计', '作品丙', '看点：作品丙的结构。', '作者甲 / 某馆藏']) assert(text.includes(word), word);
  assert(!text.includes('旧作') && !text.includes('第二句'));
  const hrefs = content.zh_cn.content.flat().filter(part => part.tag === 'a').map(part => part.href);
  for (const id of ['a', 'b', 'c']) {
    for (const href of [`https://time-space-studio.vercel.app/?view=today&work=${id}`, `https://museum.example/${id}`, `https://museum.example/rights/${id}`]) assert(hrefs.includes(href), href);
  }
  assert(hrefs.includes('https://time-space-studio.vercel.app') && hrefs.includes('https://github.com/28H2O2/time-space-studio'));
});

test('message omits the theme line when none is given and never sends empty text', () => {
  const { content } = buildMessage(library);
  assert(!JSON.stringify(content).includes('本期主题'));
  for (const part of content.zh_cn.content.flat()) assert(part.tag !== 'text' || part.text.length > 0);
});

test('long fields are shortened to one readable line', () => {
  const long = structuredClone(library);
  long.artworks[0].analysis.structure = '长'.repeat(300);
  long.artworks[0].rights.credit = '馆'.repeat(300);
  const text = JSON.stringify(buildMessage(long).content);
  assert(!text.includes('长'.repeat(100)) && !text.includes('馆'.repeat(120)));
});

test('sends a post to the chat with a bearer token and a stable dedupe uuid', async () => {
  const { impl, calls } = fakeFetch([
    { match: 'tenant_access_token', body: { code: 0, tenant_access_token: 't-secret-token' } },
    { match: 'im/v1/messages', body: { code: 0, data: { message_id: 'om_1' } } },
  ]);
  const { content } = buildMessage(library);
  const args = { appId: 'cli_app', appSecret: 'shh', chatId: 'oc_chat', fetchImpl: impl, content, dedupeKey: 'daily-2026-11-04' };
  assert.equal(await sendPost(args), 'om_1');
  assert.deepEqual(JSON.parse(calls[0].init.body), { app_id: 'cli_app', app_secret: 'shh' });
  assert.match(calls[1].url, /receive_id_type=chat_id$/);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer t-secret-token');
  const sent = JSON.parse(calls[1].init.body);
  assert.equal(sent.receive_id, 'oc_chat');
  assert.equal(sent.msg_type, 'post');
  assert.deepEqual(JSON.parse(sent.content), content);
  await sendPost(args);
  assert.equal(JSON.parse(calls[3].init.body).uuid, sent.uuid, 'a retry must reuse the same uuid');
  assert(sent.uuid.length <= 50);
});

test('API errors are reported without leaking the secret or token', async () => {
  const { impl } = fakeFetch([{ match: 'tenant_access_token', body: { code: 10003, msg: 'invalid param' } }]);
  await assert.rejects(tenantToken({ appId: 'cli_app', appSecret: 'shh-do-not-print', fetchImpl: impl }), error => {
    assert.match(error.message, /code 10003/);
    assert(!error.message.includes('shh-do-not-print'));
    return true;
  });
  const failing = fakeFetch([
    { match: 'tenant_access_token', body: { code: 0, tenant_access_token: 't-secret-token' } },
    { match: 'im/v1/messages', body: { code: 230002, msg: 'bot not in chat' } },
  ]);
  await assert.rejects(sendPost({ appId: 'a', appSecret: 'b', chatId: 'c', fetchImpl: failing.impl, content: {}, dedupeKey: 'k' }), error => {
    assert.match(error.message, /230002/);
    assert(!error.message.includes('t-secret-token'));
    return true;
  });
});

const announceArgs = fetchImpl => ({
  appId: 'cli_app', appSecret: 'shh', chatId: 'oc_chat', fetchImpl, library, title: '主题',
  readImage: item => Buffer.from(`bytes-of-${item.id}`), log: () => {},
});
const tokenOk = { match: 'tenant_access_token', body: { code: 0, tenant_access_token: 't' } };

test('each picture is uploaded first and embedded under its own work in the post', async () => {
  let n = 0;
  const { impl, calls } = fakeFetch([
    tokenOk,
    { match: 'im/v1/images', get body() { return { code: 0, data: { image_key: `img_${++n}` } }; } },
    { match: 'im/v1/messages', body: { code: 0, data: { message_id: 'om_1' } } },
  ]);
  assert.deepEqual(await announce(announceArgs(impl)), { batchId: 'daily-2026-11-04', attached: 3 });
  const uploads = calls.filter(call => call.url.includes('im/v1/images'));
  assert.equal(uploads.length, 3);
  assert(uploads[0].init.body instanceof FormData);
  assert.equal(uploads[0].init.body.get('image_type'), 'message');
  assert.equal(uploads[0].init.body.get('image').name, 'a.jpg');
  assert.equal(uploads[0].init.headers.Authorization, 'Bearer t');
  const sent = JSON.parse(JSON.parse(calls.at(-1).init.body).content);
  const keys = sent.zh_cn.content.flat().filter(part => part.tag === 'img').map(part => part.image_key);
  assert.deepEqual(keys, ['img_1', 'img_2', 'img_3']);
  const order = sent.zh_cn.content.map(paragraph => paragraph[0].tag === 'img' ? 'img' : paragraph[0].text.slice(0, 3));
  assert.deepEqual(order.slice(1, 4), ['1. ', 'img', '作者甲']);
});

test('a picture that fails to upload is left out but the text still goes out', async () => {
  const { impl, calls } = fakeFetch([
    tokenOk,
    { match: 'im/v1/images', body: { code: 99991672, msg: 'Access denied. scope im:resource required' } },
    { match: 'im/v1/messages', body: { code: 0, data: { message_id: 'om_1' } } },
  ]);
  assert.equal((await announce(announceArgs(impl))).attached, 0);
  assert(!calls.at(-1).init.body.includes('image_key'));
});

test('with required pictures nothing is sent when an upload fails', async () => {
  const { impl, calls } = fakeFetch([
    tokenOk,
    { match: 'im/v1/images', body: { code: 99991672, msg: 'Access denied. scope im:resource required' } },
  ]);
  await assert.rejects(announce({ ...announceArgs(impl), requireImages: true }), /99991672/);
  assert(!calls.some(call => call.url.includes('im/v1/messages')));
});

test('a corrected message is not suppressed by the duplicate filter of the earlier text-only one', async () => {
  const uuids = [];
  for (const withImage of [false, true]) {
    const { impl, calls } = fakeFetch([
      tokenOk,
      { match: 'im/v1/images', body: withImage ? { code: 0, data: { image_key: 'k' } } : { code: 1, msg: 'no' } },
      { match: 'im/v1/messages', body: { code: 0, data: { message_id: 'om' } } },
    ]);
    await announce(announceArgs(impl));
    uuids.push(JSON.parse(calls.at(-1).init.body).uuid);
  }
  assert.notEqual(uuids[0], uuids[1]);
});
