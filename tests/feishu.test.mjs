import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, sendPost, tenantToken } from '../scripts/feishu-notify.mjs';

const library = {
  artworks: [
    { id: 'a', title: '作品甲', creator: '作者甲', year: '1800' },
    { id: 'b', title: '作品乙', creator: '作者乙', year: '1900' },
    { id: 'c', title: '作品丙', creator: '作者丙', year: '2000' },
    { id: 'old', title: '旧作', creator: '旧', year: '1700' },
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

test('message announces the latest issue with its theme, three works and the site link', () => {
  const { batchId, content } = buildMessage(library, { title: '主题' });
  assert.equal(batchId, 'daily-2026-11-04');
  assert.match(content.zh_cn.title, /2026-11-04/);
  const text = JSON.stringify(content);
  for (const word of ['本期主题：主题', '作品甲', '作者乙 · 1900', '作品丙']) assert(text.includes(word), word);
  assert(!text.includes('旧作'));
  assert.equal(content.zh_cn.content.at(-1)[0].href, 'https://time-space-studio.vercel.app');
  assert.equal(content.zh_cn.content.length, 5);
});

test('message omits the theme line when none is given', () => {
  assert.equal(buildMessage(library).content.zh_cn.content.length, 4);
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
