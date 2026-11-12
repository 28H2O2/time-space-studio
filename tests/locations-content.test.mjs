import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLocations, validateTranslations } from '../scripts/content-validation.mjs';

const place = () => ({ id: 'museum', name: 'Museum', sourceUrl: 'https://example.org/object/1', checkedAt: '2026-11-12', verification: 'source' });

test('location validation accepts missing fields on legacy works and either or both location kinds', () => {
  for (const locations of [undefined, { collection: place() }, { depicted: [place()] }, { collection: place(), depicted: [place(), { ...place(), id: 'city' }] }]) {
    assert.doesNotThrow(() => validateLocations(locations, 'work'));
  }
});

test('location validation rejects malformed data, missing evidence and duplicate depicted IDs', () => {
  for (const locations of [null, [], {}, { collection: null }, { depicted: [] }, { depicted: [place(), place()] }]) {
    assert.throws(() => validateLocations(locations, 'work'));
  }
  for (const patch of [{ name: '' }, { id: 'bad id' }, { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: '' }, { checkedAt: '2026-02-30' }, { checkedAt: undefined }, { verification: 'inferred' }, { mapQuery: '' }, { isImpression: 'yes' }]) {
    assert.throws(() => validateLocations({ collection: { ...place(), ...patch } }, 'work'));
  }
});

test('English location overlays only translate text for existing places', () => {
  const artworks = [{ id: 'work', methods: ['x'], topics: ['y'], locations: { collection: place(), depicted: [{ ...place(), id: 'city' }] } }];
  const validate = locations => validateTranslations(artworks, { version: 1, artworks: { work: { locations } } }, [], {});
  assert.doesNotThrow(() => validate({ collection: { name: 'Museum' }, depicted: { city: { name: 'City' } } }));
  for (const locations of [{ collection: { mapQuery: 'Other' } }, { collection: { sourceUrl: 'https://example.org/other' } }, { collection: { name: '' } }, { depicted: { missing: { name: 'City' } } }, { depicted: [] }, null]) {
    assert.throws(() => validate(locations));
  }
});
