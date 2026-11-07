import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTranslations } from '../scripts/content-validation.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const hasChinese = value => /[\u4e00-\u9fff]/.test(JSON.stringify(value));

// Daily publishing adds Chinese-only works, so full coverage of the library is
// reported by `npm run check` as a notice instead of being asserted here.
test('English content is valid, consistent with the library and has no Chinese left', () => {
  const library = read('../content/library.json'), english = read('../content/library.en.json');
  const references = read('../src/lib/contemporary-references.json'), englishReferences = read('../src/lib/contemporary-references.en.json');
  validateTranslations(library.artworks, english, references, englishReferences);
  assert.equal(hasChinese(english), false);
  assert.equal(hasChinese(englishReferences), false);
});

test('translation validation rejects unknown ids, mismatched term counts and missing references', () => {
  const artworks = [{ id: 'a', methods: ['x', 'y'], topics: ['t'] }];
  const references = [{ id: 'r', methods: ['m'] }];
  const goodReference = { r: { title: 'T', summary: 'S', borrow: 'B', question: 'Q', relation: 'R', medium: 'M', methods: ['m'] } };
  assert.deepEqual(validateTranslations(artworks, { version: 1, artworks: {} }, references, goodReference).untranslated, ['a']);
  assert.throws(() => validateTranslations(artworks, { version: 1, artworks: { b: {} } }, references, goodReference), /unknown artwork/);
  assert.throws(() => validateTranslations(artworks, { version: 1, artworks: { a: { methods: ['x'] } } }, references, goodReference), /original count/);
  assert.throws(() => validateTranslations(artworks, { version: 1, artworks: {} }, references, {}), /Missing English reference/);
});
