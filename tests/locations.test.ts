import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localizeLocations, locationMapUrl, type LocationOverlay } from '../src/lib/locations.ts';
import type { ArtworkLocations } from '../src/lib/types.ts';
import { localizeArtworks } from '../src/lib/i18n.ts';

const base: ArtworkLocations = {
  collection: { id: 'museum', name: '博物馆', region: '纽约', sourceUrl: 'https://example.org/object/1', checkedAt: '2026-11-12', verification: 'source', mapQuery: 'Museum, New York, USA', isImpression: true },
  depicted: [
    { id: 'mountain', name: '泰山', region: '中国山东', note: '想象山水连接', sourceUrl: 'https://example.org/object/1', checkedAt: '2026-11-12', verification: 'source' },
    { id: 'city', name: '济南', sourceUrl: 'https://example.org/object/1', checkedAt: '2026-11-12', verification: 'source' },
  ],
};

test('maps encode multilingual names and special characters as a single query', () => {
  const query = '中国山东 · 泰山 & Museum #1 / café?';
  const url = new URL(locationMapUrl(query)!);
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.pathname, '/maps/search/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('query'), query);
  assert.equal([...url.searchParams].length, 2);
  assert.equal(url.hash, '');
  assert.equal(locationMapUrl(undefined), undefined);
  assert.equal(locationMapUrl('  '), undefined);
});

test('location translation is keyed by id, falls back field by field and preserves evidence', () => {
  const original = structuredClone(base);
  const translated = localizeLocations(base, { collection: { name: 'Museum' }, depicted: { city: { name: "Ji'nan" } } })!;
  assert.equal(translated.collection?.name, 'Museum');
  assert.equal(translated.collection?.region, '纽约');
  assert.equal(translated.collection?.isImpression, true);
  assert.equal(translated.collection?.mapQuery, base.collection?.mapQuery);
  assert.equal(translated.depicted?.[0].note, '想象山水连接');
  assert.equal(translated.depicted?.[1].name, "Ji'nan");
  assert.deepEqual(base, original);
  assert.equal(localizeLocations(base), base);
  assert.equal(localizeLocations(undefined, { collection: { name: 'Orphan' } }), undefined);
});

test('translation cannot override collection identity, evidence or map destinations at runtime', () => {
  const overlay = { collection: { name: 'Museum', id: 'wrong', sourceUrl: 'https://wrong.example/', checkedAt: '1900-01-01', verification: 'catalogue-record', mapQuery: 'Wrong', isImpression: false } } as LocationOverlay;
  const result = localizeLocations(base, overlay)!;
  assert.deepEqual(result.collection, { ...base.collection, name: 'Museum' });
});

test('artwork localization integrates locations and keeps older records valid', () => {
  const library = JSON.parse(readFileSync(new URL('../content/library.json', import.meta.url), 'utf8'));
  const work = { ...library.artworks[0], locations: base };
  const [result] = localizeArtworks([work], { [work.id]: { locations: { collection: { name: 'Museum' } } } });
  assert.equal(result.locations?.collection?.name, 'Museum');
  assert.equal(result.locations?.collection?.sourceUrl, base.collection?.sourceUrl);
  const old = { ...work, locations: undefined };
  assert.equal(localizeArtworks([old], { [old.id]: { title: 'Old' } })[0].locations, undefined);
});
