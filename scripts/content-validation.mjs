import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const isTimestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export const isDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isTimestamp(value) && new Date(value).toISOString().slice(0, 10) === value;
export const text = value => typeof value === 'string' && value.trim().length > 0;
export const url = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateArtworks(artworks, readImage) {
  assert(Array.isArray(artworks) && artworks.length > 0);
  const ids = new Set(), images = new Set(), hashes = new Set();
  for (const a of artworks) {
    assert(/^[a-z0-9][a-z0-9-]+$/.test(a.id) && !a.id.startsWith('personal-'), `Invalid id: ${a.id}`);
    assert(!ids.has(a.id), `Duplicate artwork: ${a.id}`); ids.add(a.id);
    assert(['time-space', 'graphic', 'art'].includes(a.category), `Invalid category: ${a.id}`);
    for (const key of ['title', 'titleOriginal', 'creator', 'year', 'observation', 'evidence']) assert(text(a[key]), `Missing ${key}: ${a.id}`);
    assert(url(a.sourceUrl), `Invalid source: ${a.id}`);
    for (const key of ['methods', 'topics']) assert(Array.isArray(a[key]) && a[key].length && a[key].every(text), `Missing ${key}: ${a.id}`);
    for (const key of ['structure', 'borrow', 'application']) assert(text(a.analysis?.[key]), `Missing analysis: ${a.id}`);
    for (const key of ['label', 'credit', 'usage']) assert(text(a.rights?.[key]), `Missing rights: ${a.id}`);
    assert(url(a.rights.url), `Invalid rights URL: ${a.id}`);
    assert(isTimestamp(a.addedAt) && isTimestamp(a.writing?.generatedAt), `Invalid date: ${a.id}`);
    assert(/^[a-f0-9]{64}$/.test(a.writing.inputHash), `Missing input hash: ${a.id}`);
    if (a.writing.author) {
      assert(['dot', 'codex'].includes(a.writing.author));
      assert(Array.isArray(a.writing.referenceSources) && a.writing.referenceSources.length && a.writing.referenceSources.every(url));
    } else assert(['gemini-4-argon', 'factory/gemini-4-argon'].includes(a.writing.model));
    assert(Number.isInteger(a.width) && a.width > 0 && Number.isInteger(a.height) && a.height > 0);
    assert(/^[a-z0-9][a-z0-9-]+\.(jpg|png)$/.test(a.imageKey) && !a.imageKey.startsWith('personal-'));
    assert(!images.has(a.imageKey), `Duplicate image name: ${a.imageKey}`); images.add(a.imageKey);
    const bytes = readImage(a);
    assert(bytes.length > 100 && bytes.length < 20_000_000, `Invalid image size: ${a.imageKey}`);
    assert(a.imageKey.endsWith('.png') ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : bytes[0] === 255 && bytes[1] === 216, `Invalid image bytes: ${a.imageKey}`);
    const hash = sha256(bytes);
    assert(!hashes.has(hash), `Duplicate image: ${a.imageKey}`); hashes.add(hash);
  }
  return { ids, images };
}

export function validateLibrary(data, readImage) {
  const { ids, images } = validateArtworks(data.artworks, readImage);
  assert(Array.isArray(data.batches) && data.batches.length);
  const batches = new Set(), queueIds = new Set();
  for (const b of data.batches) {
    assert(text(b.id) && !batches.has(b.id), `Duplicate issue: ${b.id}`); batches.add(b.id);
    assert(isDay(b.date) && isTimestamp(b.createdAt) && b.status === 'published');
    assert(Number.isInteger(b.count) && b.count >= b.featuredIds.length && b.count <= ids.size);
    assert(b.featuredIds.length === 3 && new Set(b.featuredIds).size === 3 && b.featuredIds.every(id => ids.has(id)), `Invalid issue: ${b.id}`);
    if (b.queueId !== undefined) {
      assert(/^queue-[a-z0-9-]+$/.test(b.queueId) && !queueIds.has(b.queueId), `Repeated queue item: ${b.queueId}`);
      queueIds.add(b.queueId);
    }
  }
  assert(isTimestamp(data.latestSuccess) && data.latestSuccess === data.batches[0].createdAt, 'latestSuccess must match the latest issue');
  for (let i = 1; i < data.batches.length; i++) assert(Date.parse(data.batches[i - 1].createdAt) >= Date.parse(data.batches[i].createdAt), 'Issues must be newest first');
  return { ids, images, batches };
}
