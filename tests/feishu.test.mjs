import test from 'node:test';
import assert from 'node:assert/strict';
import { announce, buildMessages, sendMessage, tenantToken } from '../scripts/feishu-notify.mjs';

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

const walk = (node, visit) => {
  visit(node);
  if (Array.isArray(node)) node.forEach(child => walk(child, visit));
  else if (node && typeof node === 'object') Object.values(node).forEach(child => walk(child, visit));
};
const urls = card => {
  const found = [];
  walk(card, node => { if (node?.type === 'open_url') found.push(node.default_url); });
  return found;
};

test('an overview card is followed by one card per work, in order', () => {
  const { batchId, cards } = buildMessages(library, { title: '主题' });
  assert.equal(batchId, 'daily-2026-11-04');
  assert.equal(cards.length, 4);
  for (const card of cards) assert.equal(card.schema, '2.0');
  const overview = JSON.stringify(cards[0]);
  for (const word of ['2026-11-04', '主题', '作品甲', '作品乙', '作品丙', '作者丙 · 2000']) assert(overview.includes(word), word);
  assert(!overview.includes('旧作'));
  assert.deepEqual(urls(cards[0]), ['https://time-space-studio.vercel.app', 'https://github.com/28H2O2/time-space-studio']);

  const second = JSON.stringify(cards[2]);
  for (const word of ['今日选图 2 / 3', '平面设计', '作品乙', '作者乙 · 1900', '看点', '作品乙的结构。', '作者乙 / 某馆藏']) assert(second.includes(word), word);
  assert(!second.includes('第二句'));
  for (const [index, id] of ['a', 'b', 'c'].entries()) {
    assert.deepEqual(urls(cards[index + 1]), [
      `https://time-space-studio.vercel.app/?view=today&work=${id}`, `https://museum.example/${id}`, `https://museum.example/rights/${id}`,
    ]);
  }
});

test('each work card gets the picture uploaded for that work and a colour for its category', () => {
  const { cards } = buildMessages(library, { images: { a: 'img_a', c: 'img_c' } });
  const imageKeys = card => { const keys = []; walk(card, node => { if (node?.tag === 'img') keys.push(node.img_key); }); return keys; };
  assert.deepEqual(imageKeys(cards[1]), ['img_a']);
  assert.deepEqual(imageKeys(cards[2]), []);
  assert.deepEqual(imageKeys(cards[3]), ['img_c']);
  assert.deepEqual(cards.slice(1).map(card => card.header.template), ['blue', 'orange', 'purple']);
});

test('the theme is left out when none is given, text is never empty and markup characters are neutralised', () => {
  const tricky = structuredClone(library);
  tricky.artworks[0].title = '带*星号*与<标签>的[作品]';
  const { cards } = buildMessages(tricky);
  assert(!JSON.stringify(cards[0]).includes('"heading"'), 'no theme heading expected');
  walk(cards, node => { if (node?.tag === 'markdown') assert(node.content.trim().length > 0); });
  const text = JSON.stringify(cards[1]);
  assert(text.includes('带＊星号＊与＜标签＞的［作品］'));
  assert(!text.includes('带*星号*'));
});

test('long fields are shortened to one readable line', () => {
  const long = structuredClone(library);
  long.artworks[0].analysis.structure = '长'.repeat(300);
  long.artworks[0].rights.credit = '馆'.repeat(300);
  const text = JSON.stringify(buildMessages(long).cards);
  assert(!text.includes('长'.repeat(100)) && !text.includes('馆'.repeat(120)));
});

test('sends a card to the chat with a bearer token and a stable dedupe uuid', async () => {
  const { impl, calls } = fakeFetch([
    { match: 'tenant_access_token', body: { code: 0, tenant_access_token: 't-secret-token' } },
    { match: 'im/v1/messages', body: { code: 0, data: { message_id: 'om_1' } } },
  ]);
  const { cards } = buildMessages(library);
  const args = { appId: 'cli_app', appSecret: 'shh', chatId: 'oc_chat', fetchImpl: impl, msgType: 'interactive', content: cards[0], dedupeKey: 'k' };
  assert.equal(await sendMessage(args), 'om_1');
  assert.deepEqual(JSON.parse(calls[0].init.body), { app_id: 'cli_app', app_secret: 'shh' });
  assert.match(calls[1].url, /receive_id_type=chat_id$/);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer t-secret-token');
  const sent = JSON.parse(calls[1].init.body);
  assert.equal(sent.receive_id, 'oc_chat');
  assert.equal(sent.msg_type, 'interactive');
  assert.deepEqual(JSON.parse(sent.content), cards[0]);
  await sendMessage(args);
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
  await assert.rejects(sendMessage({ appId: 'a', appSecret: 'b', chatId: 'c', fetchImpl: failing.impl, msgType: 'interactive', content: {}, dedupeKey: 'k' }), error => {
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
const sentCards = calls => calls.filter(call => call.url.includes('im/v1/messages')).map(call => JSON.parse(JSON.parse(call.init.body).content));

test('pictures are uploaded first, then the overview and the three work cards are sent', async () => {
  let n = 0;
  const { impl, calls } = fakeFetch([
    tokenOk,
    { match: 'im/v1/images', get body() { return { code: 0, data: { image_key: `img_${++n}` } }; } },
    { match: 'im/v1/messages', body: { code: 0, data: { message_id: 'om_1' } } },
  ]);
  assert.deepEqual(await announce(announceArgs(impl)), { batchId: 'daily-2026-11-04', attached: 3, sent: 4 });
  const uploads = calls.filter(call => call.url.includes('im/v1/images'));
  assert.equal(uploads.length, 3);
  assert(uploads[0].init.body instanceof FormData);
  assert.equal(uploads[0].init.body.get('image_type'), 'message');
  assert.equal(uploads[0].init.body.get('image').name, 'a.jpg');
  assert.equal(uploads[0].init.headers.Authorization, 'Bearer t');
  const firstSend = calls.findIndex(call => call.url.includes('im/v1/messages'));
  assert(calls.slice(firstSend).every(call => !call.url.includes('im/v1/images')), 'uploads must finish before any send');
  const cards = sentCards(calls);
  assert.equal(cards.length, 4);
  assert(JSON.stringify(cards[1]).includes('img_1') && JSON.stringify(cards[3]).includes('img_3'));
  const uuids = calls.filter(call => call.url.includes('im/v1/messages')).map(call => JSON.parse(call.init.body).uuid);
  assert.equal(new Set(uuids).size, 4, 'each card needs its own dedupe uuid');
});

test('a picture that fails to upload is left out but the cards still go out', async () => {
  const { impl, calls } = fakeFetch([
    tokenOk,
    { match: 'im/v1/images', body: { code: 99991672, msg: 'Access denied. scope im:resource required' } },
    { match: 'im/v1/messages', body: { code: 0, data: { message_id: 'om_1' } } },
  ]);
  const result = await announce(announceArgs(impl));
  assert.equal(result.attached, 0);
  assert.equal(result.sent, 4);
  assert(!JSON.stringify(sentCards(calls)).includes('img_key'));
});

test('with required pictures nothing is sent when an upload fails', async () => {
  const { impl, calls } = fakeFetch([
    tokenOk,
    { match: 'im/v1/images', body: { code: 99991672, msg: 'Access denied. scope im:resource required' } },
  ]);
  await assert.rejects(announce({ ...announceArgs(impl), requireImages: true }), /99991672/);
  assert(!calls.some(call => call.url.includes('im/v1/messages')));
});

test('a failed send reports how many cards had already gone out', async () => {
  let sends = 0;
  const impl = async url => {
    const body = String(url).includes('tenant_access_token') ? { code: 0, tenant_access_token: 't' }
      : String(url).includes('im/v1/images') ? { code: 0, data: { image_key: 'k' } }
      : ++sends === 3 ? { code: 230002, msg: 'bot not in chat' } : { code: 0, data: { message_id: 'om' } };
    return new Response(JSON.stringify(body));
  };
  await assert.rejects(announce(announceArgs(impl)), /message 3 of 4 failed after 2 sent.*230002/);
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
    uuids.push(JSON.parse(calls.at(-2).init.body).uuid);
  }
  assert.notEqual(uuids[0], uuids[1]);
});
