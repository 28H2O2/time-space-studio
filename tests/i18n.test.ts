import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLang, localizeArtworks, formatDate } from '../src/lib/i18n.ts';
import type { Artwork } from '../src/lib/types.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const hasChinese = (value: unknown) => /[\u4e00-\u9fff]/.test(JSON.stringify(value));

test('language resolution prefers the link, then the saved choice, then the browser', () => {
  assert.equal(resolveLang('?lang=en', 'zh', 'zh-CN'), 'en');
  assert.equal(resolveLang('?lang=fr', 'en', 'zh-CN'), 'en');
  assert.equal(resolveLang('', null, 'en-GB'), 'en');
  assert.equal(resolveLang('', null, 'zh-TW'), 'zh');
  assert.equal(resolveLang('', 'bad', 'de-DE'), 'zh');
});

test('both interface copies define exactly the same keys', () => {
  const zh = read('../src/lib/copy.zh.json'), en = read('../src/lib/copy.en.json');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [key, value] of Object.entries(en)) assert.equal(Array.isArray(value), Array.isArray(zh[key]), key);
  assert.equal(en.majorMethods.length, zh.majorMethods.length);
  // The toggle names the other language in its own script.
  const { switchLangShort, ...rest } = en;
  assert.equal(switchLangShort, '中文');
  assert.equal(hasChinese(rest), false);
});

test('localizing falls back to the original text for works without an English entry', () => {
  const library = read('../content/library.json');
  const [first, second] = library.artworks as Artwork[];
  const result = localizeArtworks([first, second], { [first.id]: { title: 'T', analysis: { borrow: 'B' }, rights: { usage: 'U' } } });
  assert.equal(result[0].title, 'T');
  assert.equal(result[0].analysis.borrow, 'B');
  assert.equal(result[0].analysis.structure, first.analysis.structure);
  assert.equal(result[0].rights.url, first.rights.url);
  assert.equal(result[0].rights.usage, 'U');
  assert.equal(result[1], second);
  assert.equal(first.title === 'T', false);
  assert.equal(localizeArtworks([first], null)[0], first);
});

test('dates follow the language', () => {
  assert.match(formatDate('2026-11-03T02:43:07.763Z', 'en'), /Nov 3, 2026/);
  assert.match(formatDate('2026-11-03T02:43:07.763Z', 'zh'), /2026/);
  assert.equal(formatDate('', 'en'), '—');
});
